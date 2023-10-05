import { getRedisClient } from "./getRedisClient.js"
import { listenRedisStream } from "./listenRedisStream.js"
import { streamFromRedisLogger as logger } from "../utils/loggers.js"
import { setTimeout } from "node:timers/promises"
import { saveCompanyNumber } from "./saveCompanyNumber.js"
import { streamPaths } from "../streams/streamPaths.js"
import { updateSchemaForEvent } from "../schemas/maintainSchemas.js"
import { VisitorCounterService } from "./visitorCounter.js"
import { Elysia } from "elysia"

const app = new Elysia()
app.get("/health", async ({ request }) => {
  const commandClient = await getRedisClient()
  const health = { currentWsConnections: 0, connections: app.server?.pendingWebSockets }
  for (const streamPath of streamPaths) {
    const lastHeartbeat = await commandClient.hGet("heartbeats", streamPath).then(t => new Date(parseInt(t || "0")))
    health[streamPath] = Date.now() - lastHeartbeat.getTime() < 60_000 // more than 60 seconds indicates stream offline
  }
  health.currentWsConnections = await commandClient.get("currentWsConnections").then(value => value ? parseInt(value) : 0)
  await commandClient.quit()
  return health
})

/** Returns an array of random company numbers */
app.get("/randomCompanyNumbers", async () => {
  const qty = 1 // this could be a search query param
  const companyNumbers = await counterClient.sRandMemberCount("companyNumbers", qty)
  return companyNumbers
})
/** Returns the `qty` most recent events in the `streamPath` stream. Eg last 100 filing events. */
app.get("/downloadHistory/:streamPath", async ({ query, params, set }) => {
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
    const historyClient = await getRedisClient()
    const history = await historyClient.xRevRange("events:" + streamPath, "+", "-", { COUNT })
    await historyClient.quit()
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
app.get("/stats/:streamPath", async ({ params, set }) => {
  const { streamPath } = params
  if (streamPaths.has(streamPath)) {
    const client = await getRedisClient()
    const rawCounts = await client.hGetAll(`counts:${streamPath}:daily`)
    const counts = Object.fromEntries(Object.entries(rawCounts).map(([date, count]) => [date, parseInt(count)]))
    await client.quit()
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
app.get("/resourceKinds/:streamPath", async ({ params, set }) => {
  const { streamPath } = params
  if (streamPaths.has(streamPath)) {
    const client = await getRedisClient()
    const rawCounts = await client.hGetAll(`resourceKinds:${streamPath}`)
    const counts = Object.fromEntries(Object.entries(rawCounts).map(([date, count]) => [date, parseInt(count)]))
    await client.quit()
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

app.get("/schemas", async () => {
  const schemasRaw = await counterClient.hGetAll("schemas")
  const schemas = Object.fromEntries(Object.entries(schemasRaw).map(([schemaName, schemaString]) => [schemaName, JSON.parse(schemaString)]))
  return schemas
})

const counterClient = await getRedisClient()
const visitorCounter = new VisitorCounterService(counterClient)
app.get("/visitors", async () => {
  const total = await visitorCounter.getTotalCount()
  const today = await visitorCounter.getCount(new Date().toISOString().split("T")[0])
  return { total, today }
})
app.get("/visitors/:date", async ({ params, set }) => {
  const { date } = params
  if (!/[0-9-]{10}/.test(date)) {
    set.status = (416)
    return ({ statusCode: 400, message: "Bad date format" })
  } else {
    if (new Date(date) < new Date("2023-09-12")) {
      set.status = (416)
      return ({
        statusCode: 416,
        message: "Records only began on 2023-09-12. Request a date after that"
      })
    } else {
      const count = await visitorCounter.getCount(date)
      return ({ [date]: count })
    }
  }
})

const ac = new AbortController()
const { signal } = ac
let unclosedWsCount = 0
// web socket server for sending events to client
app.ws("/events", {
  async open(ws) {
    unclosedWsCount++
    // subscribe to all streams and increment counter of connections
    for (const streamPath of streamPaths) {
      ws.subscribe(streamPath)
    }
    const ipAddress = String(ws.data.headers["x-forwarded-for"])
    if (ipAddress) await visitorCounter.count(ipAddress)
    else logger.info("No IP Address forwarded, skipping update to visitor statistics")
    const redisCount = await counterClient.incr("currentWsConnections")
    console.log("Websocket connected.", { clients: app.server?.pendingWebSockets, redisCount })
    signal.addEventListener("abort", () => ws.close())
  },
  async close(ws, code, reason) {
    // decrement connections counter and unsubscribe from all streams
    for (const streamPath of streamPaths)
      ws.unsubscribe(streamPath) // don't think this is necessary, surely its done automatically when a socket terminates
    const redisCount = await counterClient.decr("currentWsConnections")
    console.log("Websocket disconnected with code.", code, { clients: app.server?.pendingWebSockets, redisCount })
    unclosedWsCount--
  }
})

app.on("request", ({ request }) => console.log("Request to server", request.url))
app.listen(3000, () => console.log("Elysia Listening on port 3000"))


async function shutdown() {
  const requestTime = Bun.nanoseconds()
  try {
    logger.flush()
    console.log("Graceful shutdown commenced", new Date())
    ac.abort()
    while (unclosedWsCount) {
      if (Bun.nanoseconds() - requestTime > 2 * 1_000_000_000) break // don't keep trying if its not working after 2 sec
      await setTimeout(5) // wait for websockets to be closed gracefully before quiting the Redis client
    }
    const waitingNs = Bun.nanoseconds() - requestTime
    console.log("Closed all client connections after", waitingNs / 1000 / 1000, "ms")
    await app.stop()
    await counterClient.quit()
    logger.flush()
  } finally {
    const waitingNs = Bun.nanoseconds() - requestTime
    console.log("Graceful shutdown finished", new Date(), "in", waitingNs / 1000 / 1000, "ms")
    process.exit()
  }
}

process.on("SIGINT", shutdown) // quit on ctrl-c when running docker in terminal
process.on("SIGTERM", shutdown)// quit properly on docker stop

const eventStream = listenRedisStream({ streamKeys: [...streamPaths].map(stream => ({ stream })), signal })

for await(const event of eventStream) {
  const streamPath = event.stream.split(":")[1]
  let parsedEvent = JSON.parse(event.data.event)
  app.server?.publish(streamPath, JSON.stringify({ streamPath, ...parsedEvent }))
  if (streamPath === "companies")
    await saveCompanyNumber(counterClient, parsedEvent, streamPath)
      .catch(e => logger.error(e, "Error saving company number"))
  await updateSchemaForEvent(parsedEvent, counterClient)
}

