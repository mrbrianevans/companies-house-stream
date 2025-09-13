import { streamPaths } from "../streams/streamPaths"
import { setTimeout } from "node:timers/promises"
import { getRedisClient } from "../utils/getRedisClient"
import { streamFromRedisLogger as logger } from "../utils/loggers"
import { DatabaseSync } from "node:sqlite"
import { AbortError, commandOptions } from "redis"
import type { AnyEvent } from "../types/eventTypes"

// this connects to the Redis stream and writes events to a SQLite database

const ac = new AbortController()
const { signal } = ac

function getTableName(stream: string) {
  return stream.replaceAll(/[^a-z]/ig, "_") + "_events"
}

const db = new DatabaseSync(process.env.SQLITE_DB_PATH ?? "/data/buffer.db")
db.exec("PRAGMA journal_mode=WAL") // allow other processes to read the database while we write
for (const streamPath of streamPaths) {
  db.exec(`
      CREATE TABLE IF NOT EXISTS ${getTableName(streamPath)}
      (
          timepoint    INTEGER PRIMARY KEY,
          published_at TIMESTAMP NOT NULL,
          event_data   TEXT      NOT NULL
      )
  `)
}

// converts eg "2025-09-13T14:55:03" to a ISO compliant timestamp
function normaliseTimestamp(timestamp: string) {
  const hasTimezone = /Z$/.test(timestamp)
  if (hasTimezone) {
    return new Date(timestamp).toISOString()
  }
  return new Date(timestamp + "Z").toISOString()
}

function batchInsertEvents(streamPath: string, events: AnyEvent[]) {
  // Use SQLite upsert semantics to ignore duplicates on primary key (timepoint)
  db.exec("BEGIN TRANSACTION")
  try {
    console.log("Inserting events for streamPath:", streamPath, "with", events.length, "events")
    const placeholders = events.map(() => "(?, ?, ?)").join(", ")
    const values = events.flatMap(event => [event.event.timepoint, normaliseTimestamp(event.event.published_at), JSON.stringify(event)])
    // Using 'OR IGNORE' is valid SQLite. Some SQL parsers may flag it, but DatabaseSync executes it correctly.
    const stmt = db.prepare("INSERT OR IGNORE INTO " + getTableName(streamPath) + " (timepoint, published_at, event_data) VALUES " + placeholders)
    stmt.run(...values)
    db.exec("COMMIT")
  } catch (err) {
    db.exec("ROLLBACK")
    console.error("Batch insert failed:", err)
    throw err
  }
}

let shutdownRequestTime: number | undefined

async function shutdown() {
  shutdownRequestTime = Date.now()
  console.log("Graceful shutdown commenced", new Date())
  ac.abort()
}

process.on("SIGINT", shutdown) // quit on ctrl-c when running docker in terminal
process.on("SIGTERM", shutdown)// quit properly on docker stop

const streamingClient = await getRedisClient("streaming")

while (true) {
  try {

    if (signal?.aborted) break
    const streams = ["officers", "persons-with-significant-control", "charges", "insolvency-cases", "disqualified-officers"].map(stream => {
      const query = db.prepare(`SELECT timepoint
                                FROM ${getTableName(stream)}
                                ORDER BY timepoint DESC
                                LIMIT 1`)
      const timepoint = (query.get() as { timepoint: number } | undefined)?.timepoint?.toString()
      return ({
        key: "events:" + stream,
        id: timepoint ?? "0" // start from the beginning if no timepoint in sqlite
      })
    })
    console.debug("Streams to read:", streams)
    const options = commandOptions({ signal })
    const events = await streamingClient.xRead(options, streams, { COUNT: 1000 })
    if (events && events.length) {
      const eventsByStream = Object.groupBy(events.flatMap(({ name, messages }) =>
        messages.map(({ message }) => ({
          stream: name.split(":")[1],
          event: JSON.parse(message.event as string) as AnyEvent
        }))
      ), ({ stream }) => stream)

      for (const [stream, streamEvents] of Object.entries(eventsByStream)) {
        if (streamEvents?.length)
          batchInsertEvents(stream, streamEvents.map(({ event }) => event))
      }
    }
    await setTimeout(5000, null, { signal })
  } catch (e) {
    if (!(e instanceof AbortError) && (!(e instanceof Error) || e.name !== "AbortError"))
      logger.error(e, "Error READing from Redis Stream(s)")
    break
  }

}

db.close()
await streamingClient.quit()

if (shutdownRequestTime) {
  console.log("Graceful shutdown finished", new Date())
  const waitingMs = Date.now() - (shutdownRequestTime)
  console.log("Graceful shutdown finished", new Date(), "in", waitingMs, "ms")
  process.exit()
}