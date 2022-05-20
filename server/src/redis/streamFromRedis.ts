import { getRedisClient } from "../database/getRedisClient"
import { PassThrough } from "stream"
import express from "express"
import { WebSocketServer } from "ws"


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

app.get("/health", (req, res) => {
  res.send("i am healthy")
})

const server = app.listen(3000, () => console.log("Listening on port 3000"))


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
server.on("request", (req) => console.log("Request to web socket server", req.url))
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
