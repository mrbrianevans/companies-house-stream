import { stream } from "../streams/listenOnStream.js"
import { redisClient } from "../utils/getRedisClient.js"
import { streamKeyHolder } from "../utils/KeyHolder.js"
import { setTimeout } from "node:timers/promises"
import pino from "pino"
import { streamPaths } from "../streams/streamPaths.js"
import { Transform } from "stream"
/*

  This file listens to the Companies House long polling streaming API, and when events are received, they are posted
  to a Redis database PubSub channel called 'event:' followed by the path of the stream, eg 'event:filings'.

  Streams reconnect when ended.

 */
streamKeyHolder.addKey(process.env.STREAM_KEY)

const logger = pino()

const sendEvent = streamPath => event => redisClient.xAdd("events:" + streamPath, event.event.timepoint + "-*", { "event": JSON.stringify(event) }, {
  TRIM: {
    strategy: "MAXLEN",
    threshold: 10000,
    strategyModifier: "~"
  }
})
const incrEventCount = streamPath => event => redisClient.hIncrBy(`counts:${streamPath}:daily`, new Date().toISOString().split("T")[0], 1)
const incrResourceKindCount = streamPath => event => redisClient.hIncrBy(`resourceKinds:${streamPath}`, event.resource_kind, 1)
const updateTimepoint = streamPath => event => redisClient.hSet("timepoints", streamPath, JSON.stringify(event.event))
const heartbeat = streamPath => () => redisClient.hSet("heartbeats", streamPath, Date.now()) // keeps track of which are alive
const getMostRecentTimepoint = streamPath => redisClient.hGet("timepoints", streamPath).then(r => r ? JSON.parse(r)?.timepoint : undefined)
const startStream = streamPath => getMostRecentTimepoint(streamPath)
  .then((timepoint) => stream(streamPath, timepoint)
    .on("data", sendEvent(streamPath))
    .on("data", updateTimepoint(streamPath))
    .on("data", incrEventCount(streamPath))
    .on("data", incrResourceKindCount(streamPath))
    .on("end", () => logger.info({ streamPath }, "StreamToRedis end event fired"))
    .on("close", () => logger.info({ streamPath }, "StreamToRedis close event fired"))
    .on("error", () => logger.info({ streamPath }, "StreamToRedis error event fired"))
    .on("heartbeat", heartbeat(streamPath))
    .on("end", () => setTimeout(60000)
      .then(() => logger.info({ streamPath }, "Restarting stream, after waiting 60 seconds since disconnected."))
      .then(() => startStream(streamPath))))// restart on end

const streams = new Set<Transform>()
for (const streamPath of streamPaths) {
  streams.add(await startStream(streamPath))
  await setTimeout(5000) // space them out 5 seconds
}


async function shutdown() {
  const requestTime = performance.now()
  try {
    logger.flush()
    console.log("Graceful shutdown commenced", new Date())
    for (const stream of streams) {
      stream.destroy()
    }
    await redisClient.quit()
    logger.flush()
  } finally {
    const waitingNs = performance.now() - requestTime
    console.log("Graceful shutdown finished", new Date(), "in", waitingNs / 1000 / 1000, "ms")
    process.exit()
  }
}

process.on("SIGINT", shutdown) // quit on ctrl-c when running docker in terminal
process.on("SIGTERM", shutdown)// quit properly on docker stop
