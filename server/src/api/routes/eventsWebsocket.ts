import { Elysia } from "elysia"
import { streamPaths } from "../../streams/streamPaths"
import { streamFromRedisLogger as logger } from "../../utils/loggers"
import { VisitorCounterService } from "../visitorCounter"
import { setTimeout } from "node:timers/promises"
import { redisClient } from "../../utils/getRedisClient"

export const eventWebsocketRouter = async (app: Elysia) => {
  const visitorCounter = new VisitorCounterService(redisClient)
  const ac = new AbortController()
  const { signal } = ac
  let unclosedWsCount = 0
  app.on("stop", async () => {
    const requestTime = Bun.nanoseconds()
    ac.abort()
    while (unclosedWsCount) {
      if (Bun.nanoseconds() - requestTime > 2 * 1_000_000_000) break // don't keep trying if its not working after 2 sec
      await setTimeout(5) // wait for websockets to be closed gracefully before quiting the Redis client
    }
    const waitingNs = Bun.nanoseconds() - requestTime
    console.log("Closed all client connections after", waitingNs / 1000 / 1000, "ms")
  })
// web socket server for sending events to client
  return app.ws("/events", {
    async open(ws) {
      unclosedWsCount++
      // subscribe to all streams and increment counter of connections
      for (const streamPath of streamPaths) {
        ws.subscribe(streamPath)
      }
      const ipAddress = String(ws.data.headers["x-forwarded-for"])
      if (ipAddress) await visitorCounter.count(ipAddress)
      else logger.info("No IP Address forwarded, skipping update to visitor statistics")
      const redisCount = await redisClient.incr("currentWsConnections")
      console.log("Websocket connected.", { clients: app.server?.pendingWebSockets, redisCount })
      signal.addEventListener("abort", () => ws.close())
    },
    async close(ws, code, reason) {
      // decrement connections counter and unsubscribe from all streams
      for (const streamPath of streamPaths)
        ws.unsubscribe(streamPath) // don't think this is necessary, surely its done automatically when a socket terminates
      const redisCount = await redisClient.decr("currentWsConnections")
      console.log("Websocket disconnected with code.", code, { clients: app.server?.pendingWebSockets, redisCount })
      unclosedWsCount--
    }
  })
}
