import { getRedisClient } from "../database/getRedisClient"
import { PassThrough } from "stream"
import express from "express"
import { WebSocketServer } from "ws"

const streamPaths = new Set(["companies", "filings", "officers", "persons-with-significant-control", "charges", "insolvency-cases", "disqualified-officers"])

const redisClient = await getRedisClient()

const str = new PassThrough({ objectMode: true })
await redisClient.pSubscribe("event:*",
  (event, channel) => {
    str.write(JSON.parse(event))
  })

const clients = []
str.addListener("data", event => {
  for (const c of clients) {
    c.send(JSON.stringify(event))
  }
})


const app = express()

app.get("/health", async (req, res) => {
  const commandClient = await getRedisClient()
  const health = {}
  for (const streamPath of streamPaths) {
    const lastHeartbeat = await commandClient.get(streamPath + ":alive").then(t => new Date(parseInt(t || "0")))
    console.debug({
      lastHeartbeat,
      streamPath
    }, "Last heartbeat was", (Date.now() - lastHeartbeat.getTime()) / 1000, "seconds ago")
    health[streamPath] = Date.now() - lastHeartbeat.getTime() < 60_000 // more than 60 seconds indicates stream offline
  }
  await commandClient.quit()
  res.json(health)
})

const server = app.listen(3000, () => console.log("Listening on port 3000"))
server.on("request", (req) => console.log("Request to server", req.url))


// web socket server for sending events to client
const wss = new WebSocketServer({ noServer: true })
wss.on("connection", function connection(ws, req) {
  clients.push(ws)
  console.log("Websocket connected.", clients.length, "clients")
  ws.on("close", (code, reason) => {
    clients.splice(clients.indexOf(ws), 1)
    console.log("Websocket disconnected.", clients.length, "clients")
  })
})
// handles websocket on /events path of server
server.on("upgrade", function upgrade(request, socket, head) {
  const { pathname } = new URL(request.url, `wss://${request.headers.host}`)

  if (pathname === "/events") {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request)
    })

  } else {
    socket.destroy()
  }
})
