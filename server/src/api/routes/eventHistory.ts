import { Elysia } from "elysia"
import { streamPaths } from "../../streams/streamPaths"
import { redisClient } from "../../utils/getRedisClient"
import { get } from "https"

export const eventHistoryRouter = (app: Elysia) => {

  /** Returns the `qty` most recent events in the `streamPath` stream. Eg last 100 filing events. */
  return app.get("/downloadHistory/:streamPath", async ({ query, params, set }) => {
    const { streamPath } = params
    const { qty } = query
    const COUNT = parseInt(String(qty)) || 100 // default to send 100 events, unless specified
    if (COUNT > 10_000) {
      set.status = 400
      return {
        statusCode: 400,
        message: "Qty exceeds maximum. Must be less than 10,000. Received: " + COUNT
      }
    }
    if (streamPaths.has(streamPath)) {
      const history = await redisClient.xRevRange("events:" + streamPath, "+", "-", { COUNT })
      return history.map(h => JSON.parse(h.message.event))
    } else {
      set.status = 400
      return {
        statusCode: 400,
        message: "Invalid stream path: " + streamPath,
        possibleOptions: [...streamPaths]
      }
    }
  })

    .get("/stats/:streamPath", async ({ params, set }) => {
      const { streamPath } = params
      if (streamPaths.has(streamPath)) {
        const rawCounts = await redisClient.hGetAll(`counts:${streamPath}:daily`)
        const counts = Object.fromEntries(Object.entries(rawCounts).map(([date, count]) => [date, parseInt(count)]))
        return counts
      } else {
        set.status = (400)
        return ({
          statusCode: 400,
          message: "Invalid stream path: " + streamPath,
          possibleOptions: [...streamPaths]
        })
      }
    })
    .get("/resourceKinds/:streamPath", async ({ params, set }) => {
      const { streamPath } = params
      if (streamPaths.has(streamPath)) {
        const rawCounts = await redisClient.hGetAll(`resourceKinds:${streamPath}`)
        const counts = Object.fromEntries(Object.entries(rawCounts).map(([date, count]) => [date, parseInt(count)]))
        return counts
      } else {
        set.status = (400)
        return ({
          statusCode: 400,
          message: "Invalid stream path: " + streamPath,
          possibleOptions: [...streamPaths]
        })
      }
    })

}
