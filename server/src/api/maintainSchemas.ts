/*
Listen on the Redis stream for events, and generate JSON schemas for each event type as they come in.
Keeps updating the schema based on each event, so they stay up to date.
 */

import { redisClient } from "../utils/getRedisClient.js"
import { listenRedisStream } from "./listenRedisStream.js"
import { streamPaths } from "../streams/streamPaths.js"
import { extendSchema, createSchema } from "genson-js"
import { streamFromRedisLogger } from "../utils/loggers.js"

/** When an event arrives, merge it with the existing schema in redis (IF EXISTS) and save new schema. */
export async function updateSchemaForEvent(event, commandClient) {
  // schemas are specific to each resource kind
  const { resource_kind, data } = event
  // schemas are stored as stringified JSON in the `schemas` hash in redis
  const savedSchema = await commandClient.hGet("schemas", resource_kind).then(String).then(JSON.parse)
  if (!savedSchema) streamFromRedisLogger.info({ resource_kind }, "Schema did not exist for event type %s", resource_kind)
  const newSchema = savedSchema ? extendSchema(savedSchema, data, { noRequired: false }) : createSchema(data)
  await commandClient.hSet("schemas", resource_kind, JSON.stringify(newSchema))
}

async function maintainSchemas(signal?: AbortSignal) {
  const eventStream = listenRedisStream({ streamKeys: [...streamPaths].map(stream => ({ stream })), signal })

  for await(const event of eventStream) {
    const parsedEvent = JSON.parse(event.data.event)
    await updateSchemaForEvent(parsedEvent, redisClient)
  }

}
