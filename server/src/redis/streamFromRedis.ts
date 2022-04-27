import { getRedisClient } from "../database/getRedisClient"
import { PassThrough } from "stream"

const client = await getRedisClient()

const str = new PassThrough({ objectMode: true })
await client.subscribe("event", event => {
  str.write(JSON.parse(event))
})


for await(const m of str)
  console.log("event in stream", m.resource_id, m.resource_kind)
