import { listenRedisStream } from "./listenRedisStream.js"
import { streamFromRedisLogger as logger } from "../utils/loggers.js"
import { saveCompanyNumber } from "./saveCompanyNumber.js"
import { streamPaths } from "../streams/streamPaths.js"
import { updateSchemaForEvent } from "./maintainSchemas.js"
import { Elysia } from "elysia"
import { healthCheckRouter } from "./routes/healthCheck"
import { miscRouter } from "./routes/misc"
import { eventHistoryRouter } from "./routes/eventHistory"
import { visitorsRouter } from "./routes/visitors"
import { eventWebsocketRouter } from "./routes/eventsWebsocket"
import { redisClient } from "../utils/getRedisClient"
import { setTimeout } from "node:timers/promises"

const app = new Elysia()
  .use(healthCheckRouter)
  .use(miscRouter)
  .use(eventHistoryRouter)
  .use(visitorsRouter)
  .use(eventWebsocketRouter)
  .on("request", ({ request }) => console.log("Request to server", request.url))
  .on("stop", async () => {
    logger.flush()
    await redisClient.quit()
  })
  .listen(3000, () => console.log("Elysia Listening on port 3000"))


const ac = new AbortController()
const { signal } = ac

const eventStream = listenRedisStream({ streamKeys: [...streamPaths].map(stream => ({ stream })), signal })


async function shutdown() {
  const requestTime = Bun.nanoseconds()
  try {
    console.log("Graceful shutdown commenced", new Date())
    ac.abort()
    await app.stop()
    await setTimeout(500)
  } finally {
    const waitingNs = Bun.nanoseconds() - requestTime
    console.log("Graceful shutdown finished", new Date(), "in", waitingNs / 1000 / 1000, "ms")
    process.exit()
  }
}

process.on("SIGINT", shutdown) // quit on ctrl-c when running docker in terminal
process.on("SIGTERM", shutdown)// quit properly on docker stop

for await(const event of eventStream) {
  const streamPath = event.stream.split(":")[1]
  let parsedEvent = JSON.parse(event.data.event)
  app.server?.publish(streamPath, JSON.stringify({ streamPath, ...parsedEvent }))
  if (streamPath === "companies")
    await saveCompanyNumber(redisClient, parsedEvent, streamPath)
      .catch(e => logger.error(e, "Error saving company number"))
  await updateSchemaForEvent(parsedEvent, redisClient)
}

console.log("Async iterator of events exited", new Date())
