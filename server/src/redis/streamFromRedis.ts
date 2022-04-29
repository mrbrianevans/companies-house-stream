import { getRedisClient } from "../database/getRedisClient"
import { PassThrough } from "stream"
import express from "express"

const client = await getRedisClient()

const str = new PassThrough({ objectMode: true })
await client.pSubscribe("event:*",
  (event, channel) => {
    str.write(JSON.parse(event))
  })


for await(const m of str)
  console.log("event in stream", m.resource_id, m.resource_kind)


const app = express()

app.get("/health", (req, res) => {
  res.send("i am healthy")
})

app.listen(80)
