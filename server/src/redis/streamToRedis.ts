import "dotenv/config"
import { stream } from "../streams/listenOnStream"
import { getRedisClient } from "../database/getRedisClient"
import { restKeyHolder, streamKeyHolder } from "../utils/KeyHolder"
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
const streamPaths = new Set(["companies", "filings", "officers", "persons-with-significant-control", "charges", "insolvency-cases"])
const client = await getRedisClient()
const sendEvent = streamPath => event => client.PUBLISH("event:" + streamPath, JSON.stringify(event))
// const sendEvent = streamPath => event => logger.info("event:"+streamPath)
const updateTimepoint = streamPath => event => client.set(streamPath, JSON.stringify(event.event))
const heartbeat = streamPath => () => client.set(streamPath + ":alive", Date.now()) // keeps track of which are alive
const getMostRecentTimepoint = streamPath => client.get(streamPath).then(r => r ? JSON.parse(r)?.timepoint : undefined)
const startStream = streamPath => getMostRecentTimepoint(streamPath)
  .then((timepoint) => stream(streamPath, timepoint)
    .on("data", sendEvent(streamPath))
    .on("data", updateTimepoint(streamPath))
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

//todo: (i've made some changes which might fix this)
// - this doesn't yet achieve perfect uptime. There are some circumstances which cause it to not reconnect on some streams
