import "dotenv/config"
import { stream } from "../streams/listenOnStream.js"
import { getRedisClient } from "./getRedisClient.js"
import { restKeyHolder, streamKeyHolder } from "../utils/KeyHolder.js"
import { setTimeout } from "node:timers/promises"
import pino from "pino"
/*

  This file listens to the Companies House long polling streaming API, and when events are received, they are posted
  to a Redis database PubSub channel called 'event:' followed by the path of the stream, eg 'event:filings'.

  Streams reconnect when ended.

 */
const keys = [process.env.STREAM_KEY1, process.env.STREAM_KEY2, process.env.STREAM_KEY3]
for (const key of keys) streamKeyHolder.addKey(key)
restKeyHolder.addKey(process.env.REST_KEY1)
const logger = pino()
// permanent streams that will reconnect if they get disconnected
const streamPaths = new Set(["companies", "filings", "officers", "persons-with-significant-control", "charges", "insolvency-cases", "disqualified-officers"])
const client = await getRedisClient()
const sendEvent = streamPath => event => client.xAdd("events:" + streamPath, event.event.timepoint + "-*", { "event": JSON.stringify(event) }, {
  TRIM: {
    strategy: "MAXLEN",
    threshold: 10000,
    strategyModifier: "~"
  }
})
const incrEventCount = streamPath => event => client.hIncrBy(`counts:${streamPath}:daily`, new Date().toISOString().split('T')[0], 1)
const updateTimepoint = streamPath => event => client.set(streamPath, JSON.stringify(event.event))
const heartbeat = streamPath => () => client.set(streamPath + ":alive", Date.now()) // keeps track of which are alive
const getMostRecentTimepoint = streamPath => client.get(streamPath).then(r => r ? JSON.parse(r)?.timepoint : undefined)
const startStream = streamPath => getMostRecentTimepoint(streamPath)
  .then((timepoint) => stream(streamPath, timepoint)
    .on("data", sendEvent(streamPath))
    .on("data", updateTimepoint(streamPath))
    .on("data", incrEventCount(streamPath))
    .on("end", () => logger.info({ streamPath }, "StreamToRedis end event fired"))
    .on("close", () => logger.info({ streamPath }, "StreamToRedis close event fired"))
    .on("error", () => logger.info({ streamPath }, "StreamToRedis error event fired"))
    .on("heartbeat", heartbeat(streamPath))
    .on("end", () => setTimeout(60000)
      .then(() => logger.info({ streamPath }, "Restarting stream, after waiting 60 seconds since disconnected."))
      .then(() => startStream(streamPath))))// restart on end

for (const streamPath of streamPaths) {
  await startStream(streamPath)
  await setTimeout(5000) // space them out 5 seconds
}
