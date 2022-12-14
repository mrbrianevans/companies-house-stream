import { getRedisClient } from "./getRedisClient.js"
import express from "express"
import { WebSocketServer } from "ws"
import { EventEmitter } from "events"
import { listenRedisStream } from "./listenRedisStream.js"
import {streamFromRedisLogger as logger} from '../utils/loggers.js'
import {setTimeout} from "node:timers/promises"
import { saveCompanyNumber } from "./saveCompanyNumber.js"
import { streamPaths } from "../streams/streamPaths.js"
import { updateSchemaForEvent } from "../schemas/maintainSchemas.js"

const eventEmitter = new EventEmitter({})
eventEmitter.setMaxListeners(1_000_000) // increase max listeners (this is clients x num of streams)

const app = express()

app.get("/health", async (req, res) => {
  const commandClient = await getRedisClient()
  const health = {    currentWsConnections: 0  }
  for (const streamPath of streamPaths) {
    const lastHeartbeat = await commandClient.get(streamPath + ":alive").then(t => new Date(parseInt(t || "0")))
    health[streamPath] = Date.now() - lastHeartbeat.getTime() < 60_000 // more than 60 seconds indicates stream offline
  }
  health.currentWsConnections = await commandClient.get('currentWsConnections').then(value => value ? parseInt(value) : 0)
  await commandClient.quit()
  res.json(health)
})

app.options('/randomCompanyNumbers', (req, res)=>{
  res.setHeader('Access-Control-Allow-Origin', 'https://companiesdb.co.uk')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.end()
})
/** Returns an array of random company numbers */
app.get("/randomCompanyNumbers", async (req, res) => {
  const qty = 1 // this could be a search query param
  const companyNumbers = await counterClient.sRandMemberCount('companyNumbers', qty)
  res.setHeader('Access-Control-Allow-Origin', 'https://companiesdb.co.uk')
  res.json(companyNumbers)
})
/** Returns the `qty` most recent events in the `streamPath` stream. Eg last 100 filing events. */
app.get("/downloadHistory/:streamPath", async (req, res) => {
  const {streamPath} = req.params
  const { qty } = req.query
  const COUNT = parseInt(String(qty)) || 100 // default to send 100 events, unless specified
  if(COUNT > 10_000){
    res.status(400).json({statusCode:400, message: 'Qty exceeds maximum. Must be less than 10,000. Received: '+COUNT})
    return
  }
  if(streamPaths.has(streamPath)){
    const historyClient = await getRedisClient()
    const history = await historyClient.xRevRange('events:'+streamPath, '+', '-', {COUNT})
    res.json(history.map(h=>JSON.parse(h.message.event)))
    await historyClient.quit()
  }else{
    res.status(400).json({statusCode:400, message: 'Invalid stream path: '+streamPath, possibleOptions: [...streamPaths]})
    return
  }
})

const server = app.listen(3000, () => console.log("Listening on port 3000"))
server.on("request", (req) => console.log("Request to server", req.url))

function getListenerCounts() {
  const counts: Record<string, number> = {}
  for (const streamPath of streamPaths)
    counts[streamPath] = eventEmitter.listenerCount(streamPath)
  return counts
}
const counterClient = await getRedisClient()
const totalListeners = () => Object.values(getListenerCounts()).reduce((p, c) => p + c)
let clients = 0
// web socket server for sending events to client
const wss = new WebSocketServer({ noServer: true })
wss.on("connection", async function connection(ws, req) {
  const stream = new URL(req.url??'/events', `wss://${req.headers.host}`).searchParams.get("stream")
  const send = event => ws.send(JSON.stringify(event))
  const requestedStreams = [...streamPaths].filter(streamPath => stream === streamPath || stream === null || stream === "all")
  for (const streamPath of requestedStreams)
    eventEmitter.addListener(streamPath, send)
  clients++
  const redisCount = await counterClient.incr('currentWsConnections')
  console.log("Websocket connected.", totalListeners(), "event listeners", { clients, redisCount })
  ws.on("close", async (code, reason) => {
    for (const streamPath of requestedStreams)
      eventEmitter.removeListener(streamPath, send)
    clients--
    const redisCount = await counterClient.decr('currentWsConnections')
    console.log("Websocket disconnected with code.",code, totalListeners(), "event listeners", { clients, redisCount })
  })
  eventEmitter.on('close', () => ws.terminate()) // ws.close() doesn't seem to work. Code should be 1112
})
// handles websocket on /events path of server
server.on("upgrade", function upgrade(request, socket, head) {
  const url = new URL(request.url??'/events', `wss://${request.headers.host}`)
  if (url.pathname === "/events") {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request)
    })
  } else {
    socket.destroy()
  }
})
const ac = new AbortController()
const {signal} = ac
async function shutdown(){
  try{
    logger.flush()
    console.log("Graceful shutdown", new Date())
    eventEmitter.emit("close")
    eventEmitter.removeAllListeners()
    ac.abort()
    await setTimeout(250) // wait for websockets to be closed gracefully before quiting the Redis client
    await counterClient.quit()
    logger.flush()
    wss.close()
  }finally {
    process.exit()
  }
}
process.on('SIGINT', shutdown) // quit on ctrl-c when running docker in terminal
process.on('SIGTERM', shutdown)// quit properly on docker stop

const eventStream = listenRedisStream({streamKeys: [...streamPaths].map(stream=>({stream})), signal})

for await(const event of eventStream) {
  const streamPath = event.stream.split(":")[1]
  let parsedEvent = JSON.parse(event.data.event)
  eventEmitter.emit(streamPath, { streamPath, ...parsedEvent })
  if(streamPath === 'companies')
    await saveCompanyNumber(counterClient, parsedEvent, streamPath)
      .catch(e=>logger.error(e, 'Error saving company number'))
  await updateSchemaForEvent(parsedEvent, counterClient)
}

