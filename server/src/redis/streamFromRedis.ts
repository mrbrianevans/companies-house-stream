import { getRedisClient } from "../database/getRedisClient"
import { PassThrough } from "stream"
import express from "express"
import { WebSocketServer } from "ws"
import { parse } from "url"

const client = await getRedisClient()

const str = new PassThrough({ objectMode: true })
await client.pSubscribe("event:*",
  (event, channel) => {
    str.write(JSON.parse(event))
  })


// for await(const m of str)
//   console.log("event in stream", m.resource_id, m.resource_kind)


const app = express()

app.get("/health", (req, res) => {
  res.send("i am healthy")
})

const server = app.listen(3000, () => console.log("Listening on port 3000"))


// web socket server for sending events to client
const wss = new WebSocketServer({ noServer: true })
wss.on("connection", function connection(ws, req) {
  console.log("Connected to websocket")
  const sendEvent = event => ws.send(JSON.stringify(event))
  str.addListener("data", sendEvent)
  ws.on("close", () => {
    str.removeListener("data", sendEvent)
  })
})
server.on("request", (req) => console.log("Request to web socket server", req.url))
// handles websocket on /events path of server
server.on("upgrade", function upgrade(request, socket, head) {
  const { pathname } = parse(request.url)

  if (pathname === "/events") {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request)
    })

  } else {
    socket.destroy()
  }
})
