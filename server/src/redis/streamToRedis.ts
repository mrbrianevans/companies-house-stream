import "dotenv/config"
import { stream } from "../streams/listenOnStream"
import { getRedisClient } from "../database/getRedisClient"
import { restKeyHolder, streamKeyHolder } from "../utils/KeyHolder"
/*

  This file listens to the companies house long polling streaming API, and when events are recieved, they are posted
  to a Redis database PubSub channel called 'event'.

 */
streamKeyHolder.addKey(process.env.STREAM_KEY1)
streamKeyHolder.addKey(process.env.STREAM_KEY2)
streamKeyHolder.addKey(process.env.STREAM_KEY3)
restKeyHolder.addKey(process.env.REST_KEY1)

//todo: these need to be replaced with permanent stream that will reconnect if they get disconnected
const companyStream = stream("companies")
const filingStream = stream("filings")
const officerStream = stream("officers")
const pscStream = stream("persons-with-significant-control")
const chargeStream = stream("charges")
const insolvencyStream = stream("insolvency-cases")

// send events to pubsub
const client = await getRedisClient()
const sendEvent = event => client.PUBLISH("event", JSON.stringify(event))
companyStream.addListener("data", sendEvent)
filingStream.addListener("data", sendEvent)
officerStream.addListener("data", sendEvent)
pscStream.addListener("data", sendEvent)
chargeStream.addListener("data", sendEvent)
insolvencyStream.addListener("data", sendEvent)
