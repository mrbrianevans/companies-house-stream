import { Elysia } from "elysia"
import { redisClient } from "../../utils/getRedisClient"
import { streamPaths } from "../../streams/streamPaths"

export const healthCheckRouter = (app: Elysia) => app.get("/health", async () => {
  const health = { currentWsConnections: 0, connections: app.server?.pendingWebSockets }
  const streamsHealth: Record<string, boolean> = {}
  for (const streamPath of streamPaths) {
    const lastHeartbeat = await redisClient.hGet("heartbeats", streamPath).then(t => new Date(parseInt(t || "0")))
    streamsHealth[streamPath] = Date.now() - lastHeartbeat.getTime() < 60_000 // more than 60 seconds indicates stream offline
  }
  health.currentWsConnections = await redisClient.get("currentWsConnections").then(value => value ? parseInt(value) : 0)
  return { ...health, ...streamsHealth }
})
