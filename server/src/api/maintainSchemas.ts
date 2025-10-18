/*
Listen on the Redis stream for events, and generate JSON schemas for each event type as they come in.
Keeps updating the schema based on each event, so they stay up to date.
 */

import { type RedisClient } from "../utils/getRedisClient.js"
import { extendSchema, createSchema, Schema } from "genson-js"
import { streamFromRedisLogger } from "../utils/loggers.js"
import { AnyEvent } from "../types/eventTypes"
import { isSubset } from "genson-js/dist"
import { existsSync } from "node:fs"
import { simpleGit, SimpleGit, SimpleGitOptions } from "simple-git"
import { writeFile } from "node:fs/promises"
import { mkdirSync } from "fs"

/** When an event arrives, merge it with the existing schema in redis (IF EXISTS) and save new schema. */
export async function updateSchemaForEvent(event: AnyEvent, commandClient: RedisClient) {
  // schemas are specific to each resource kind
  const { resource_kind, data } = event
  // schemas are stored as stringified JSON in the `schemas` hash in redis
  const savedSchema = await commandClient.hGet("schemas", resource_kind).then(String).then(JSON.parse)
  if (!savedSchema) streamFromRedisLogger.info({ resource_kind }, "Schema did not exist for event type %s", resource_kind)
  const newSchema = savedSchema ? extendSchema(savedSchema, data, { noRequired: false }) : createSchema(data)
  await commandClient.hSet("schemas", resource_kind, JSON.stringify(newSchema))

  const schemaOfEvent = createSchema(data, { noRequired: false })
  const matchesExisting = isSubset(savedSchema || {}, schemaOfEvent)
  if (!matchesExisting) {
    streamFromRedisLogger.info({
      resource_kind,
      savedSchema,
      schemaOfEvent,
      data
    }, "Event did not match existing schema %s", resource_kind)
    const newGitSchema = await addEventToSchema(event, newSchema)
    // update schema in redis
    await commandClient.hSet("schemas", resource_kind, JSON.stringify(newGitSchema))
  }
}


async function addEventToSchema(event: AnyEvent, newRedisSchema: Schema) {

  if (!existsSync("/companies-stream-schemas")) {
    mkdirSync("/companies-stream-schemas", { recursive: true })
  }

  const options: Partial<SimpleGitOptions> = {
    baseDir: "/companies-stream-schemas",
    maxConcurrentProcesses: 1
  }

  const git: SimpleGit = simpleGit(options)

  const alreadyCloned = await git.checkIsRepo()
  if (!alreadyCloned) {
    await git.clone(`https://${process.env.GITHUB_TOKEN}@github.com/mrbrianevans/companies-stream-schemas.git`, "/companies-stream-schemas")
  }
  // git pull to get external updates
  await git.pull("origin", "master")

  // compare schemaFromEvent against schema in repo
  const gitSchema = await git.show("master:schemas/" + event.resource_kind + ".json")
  const schemaOfEvent = createSchema(event, { noRequired: false })
  const matchesExisting = gitSchema ? isSubset(JSON.parse(gitSchema), schemaOfEvent) : false
  if (matchesExisting) {
    streamFromRedisLogger.info({ event }, "Event already matched schema in git")
    return JSON.parse(gitSchema)
  }
  // extend repo schema with event
  const newGitSchema = gitSchema ? extendSchema(JSON.parse(gitSchema), event, { noRequired: false }) : newRedisSchema

  const newSchemaContent = JSON.stringify(newGitSchema, null, 2)
  await writeFile("/companies-stream-schemas/schemas/" + event.resource_kind + ".json", newSchemaContent)
  await git.addConfig("user.name", "Companies House Stream")
  await git.addConfig("user.email", "")
  await git.add("schemas/" + event.resource_kind + ".json")
  // commit changes. TODO: use grok for description.
  await git.commit("Update schema " + event.resource_kind)
  // push changes
  await git.push("origin", "master")
  return newGitSchema
}
