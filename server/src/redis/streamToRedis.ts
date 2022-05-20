import "dotenv/config"
import { stream } from "../streams/listenOnStream"
import { getRedisClient } from "../database/getRedisClient"
import { restKeyHolder, streamKeyHolder } from "../utils/KeyHolder"
/*

  This file listens to the Companies House long polling streaming API, and when events are received, they are posted
  to a Redis database PubSub channel called 'event:' followed by the path of the stream, eg 'filings'.

  Streams reconnect when ended.

 */
const keys = [process.env.STREAM_KEY1, process.env.STREAM_KEY2, process.env.STREAM_KEY3]
for (const key of keys) streamKeyHolder.addKey(key)
restKeyHolder.addKey(process.env.REST_KEY1)

// permanent streams that will reconnect if they get disconnected
const streamPaths = new Set(["companies", "filings", "officers", "persons-with-significant-control", "charges", "insolvency-cases"])
const client = await getRedisClient()
const sendEvent = streamPath => event => client.PUBLISH("event:" + streamPath, JSON.stringify(event))
const updateTimepoint = streamPath => event => client.set(streamPath, JSON.stringify(event.event))
// const sendEvent = streamPath => event => console.log("event:"+streamPath)
const getMostRecentTimepoint = streamPath => client.get(streamPath).then(r => r ? JSON.parse(r)?.timepoint : undefined)
const startStream = streamPath => getMostRecentTimepoint(streamPath)
  .then((timepoint) => stream(streamPath, timepoint)
    .on("data", sendEvent(streamPath))
    .on("data", updateTimepoint(streamPath))
    .on("end", () => startStream(streamPath))
  )// restart on end
for (const streamPath of streamPaths) {
  await startStream(streamPath)
  await new Promise(resolve => setTimeout(resolve, 5000))
}