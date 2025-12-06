import { scheduler } from "node:timers/promises"
import { getRedisClient } from "../utils/getRedisClient"
import { streamFromRedisLogger as logger } from "../utils/loggers"
import { DatabaseSync } from "node:sqlite"
import type { AnyEvent } from "../types/eventTypes"
import cron from "node-cron"
import { getTableName, readStreams } from "./utils"
import { runNightlyExport } from "./runNightlyExport"

// this connects to the Redis stream and writes events to a SQLite database
/* redis stream -> sqlite -> json file -> duckdb table -> parquet in S3 */

const ac = new AbortController()
const { signal } = ac


const db = new DatabaseSync(process.env.SQLITE_DB_PATH ?? "/data/buffer.db")
db.exec("PRAGMA journal_mode=WAL") // allow other processes to read the database while we write
for (const streamPath of readStreams) {
  db.exec(`
      CREATE TABLE IF NOT EXISTS ${getTableName(streamPath)}
      (
          timepoint    INTEGER PRIMARY KEY,
          published_at TIMESTAMP NOT NULL,
          event_data   TEXT      NOT NULL
      );
  `)
}


// Prepare and cache statements used inside the loop to avoid per-iteration native allocations
const lastTimepointStmt = new Map<string, ReturnType<typeof db.prepare>>()
for (const stream of readStreams) {
  lastTimepointStmt.set(
    stream,
    db.prepare(`SELECT timepoint
                FROM ${getTableName(stream)}
                ORDER BY timepoint DESC
                LIMIT 1`)
  )
}

/*
implement a batch job that runs nightly in sqlitePersistence.ts. it should move data from the sqlite database to parquet files on an s3 bucket. it should be scheduled for 2am every day with node-cron. it should query all events in each events table of the sqlite database and using duckdb, copy to parquet files on the s3 bucket. and then delete the rows from sqlite. do it in a transaction so that if upload fails, it will not delete the rows in sqlite. parse the event data using json_extract in duckdb. use the @duckdb/node-api package. store the files with file paths like /streamName/year=YYYY/month=MM/day=DD/<uuid>.parquet. pass the s3 credentials into duckdb from process.environment
 */

// Nightly export job setup


let exportUnderway = false

async function startNightlyExport() {
  console.log("Nightly export started")
  if (exportUnderway) {
    throw new Error(
      "Nightly export already underway, please wait until it finishes before starting another one"
    )
  }
  exportUnderway = true
  try {
    await runNightlyExport(db)
  } catch (e) {
    console.error("Nightly export failed:", e)
  } finally {
    exportUnderway = false
  }
}

// Schedule at 2am server local time daily. could be run more often during times of bulk loading by CH.
cron.schedule("0 2 * * *", () => {
  startNightlyExport().catch(err => console.error("Nightly export error:", err))
})
await startNightlyExport() //run on startup

// converts eg "2025-09-13T14:55:03" to a ISO compliant timestamp
function normaliseTimestamp(timestamp: string) {
  try {
    const hasTimezone = /Z$/.test(timestamp) || /\+\d\d:\d\d$/.test(timestamp)
    if (hasTimezone) {
      return new Date(timestamp).toISOString()
    }
    return new Date(timestamp + "Z").toISOString()
  } catch (e) {
    console.log("Failed to normalise", timestamp)
    throw e
  }

}

function batchInsertEvents(streamPath: string, events: AnyEvent[]) {
  // Use SQLite upsert semantics to ignore duplicates on primary key (timepoint)
  db.exec("BEGIN TRANSACTION")
  try {
    console.debug("Inserting events for streamPath:", streamPath, "with", events.length, "events")
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
    const streams = readStreams.map(stream => {
      const query = lastTimepointStmt.get(stream)!
      const timepoint = (query.get() as { timepoint: number } | undefined)?.timepoint?.toString()
      return ({
        key: "events:" + stream,
        id: timepoint ?? "0" // start from the beginning if no timepoint in sqlite
      })
    })
    // console.debug("Streams to read:", streams)
    const events = await streamingClient.xRead(streams, { COUNT: 1000 })
    if (events && events.length && !exportUnderway) {
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
    } else if (exportUnderway) {
      logger.info("Skipping events load into sqlite during export")
    }
    // if there were less than 1000 events, sleep for 6 seconds before reading again
    const totalEvents = events?.flatMap(({ messages }) => messages).length ?? 0
    const waitDuration = totalEvents >= 1000 ? 50 : 6_000
    await scheduler.wait(waitDuration, { signal })
  } catch (e) {
    if (e instanceof Error && e.name !== "AbortError")
      logger.error(e, "Error READing from Redis Streams")
    else
      logger.info("Aborted listening to Redis Streams")
    break
  }

}

db.close()
await streamingClient.quit()

if (shutdownRequestTime) {
  const waitingMs = Date.now() - (shutdownRequestTime)
  console.log("Graceful shutdown finished", new Date(), "in", waitingMs, "ms")
  process.exit()
}

