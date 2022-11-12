import { getRedisClient } from "../database/getRedisClient.js"
import express from "express"
import { WebSocketServer } from "ws"
import { EventEmitter } from "events"
import { listenRedisStream } from "./listenRedisStream.js"

const streamPaths = new Set(["companies", "filings", "officers", "persons-with-significant-control", "charges", "insolvency-cases", "disqualified-officers"])
const eventEmitter = new EventEmitter({})
eventEmitter.setMaxListeners(1_000_000) // increase max listeners (this is clients x num of streams)

const app = express()

app.get("/health", async (req, res) => {
  const commandClient = await getRedisClient()
  const health = {}
  for (const streamPath of streamPaths) {
    const lastHeartbeat = await commandClient.get(streamPath + ":alive").then(t => new Date(parseInt(t || "0")))
    health[streamPath] = Date.now() - lastHeartbeat.getTime() < 60_000 // more than 60 seconds indicates stream offline
  }
  await commandClient.quit()
  res.json(health)
})

const server = app.listen(3000, () => console.log("Listening on port 3000"))
server.on("request", (req) => console.log("Request to server", req.url))

function getListenerCounts() {
  const counts: Record<string, number> = {}
  for (const streamPath of streamPaths)
    counts[streamPath] = eventEmitter.listenerCount(streamPath)
  return counts
}

const totalListeners = () => Object.values(getListenerCounts()).reduce((p, c) => p + c)
let clients = 0
// web socket server for sending events to client
const wss = new WebSocketServer({ noServer: true })
wss.on("connection", function connection(ws, req) {
  const stream = new URL(req.url, `wss://${req.headers.host}`).searchParams.get("stream")
  const send = event => ws.send(JSON.stringify(event))
  const requestedStreams = [...streamPaths].filter(streamPath => stream === streamPath || stream === null || stream === "all")
  for (const streamPath of requestedStreams)
    eventEmitter.addListener(streamPath, send)
  clients++
  console.log("Websocket connected.", totalListeners(), "event listeners", { clients })
  ws.on("close", (code, reason) => {
    for (const streamPath of requestedStreams)
      eventEmitter.removeListener(streamPath, send)
    clients--
    console.log("Websocket disconnected.", totalListeners(), "event listeners", { clients })
  })
})
// handles websocket on /events path of server
server.on("upgrade", function upgrade(request, socket, head) {
  const url = new URL(request.url, `wss://${request.headers.host}`)
  if (url.pathname === "/events") {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request)
    })
  } else {
    socket.destroy()
  }
})

for await(const event of listenRedisStream([...streamPaths].map(streamPath=>"events:" + streamPath))){
  const streamPath = event.stream.split(":")[1]
  eventEmitter.emit(streamPath, { streamPath, ...JSON.parse(event.data.event) })
}
