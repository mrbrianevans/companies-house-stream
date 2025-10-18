import { scheduler } from "node:timers/promises"
import { getRedisClient } from "../utils/getRedisClient"
import { streamFromRedisLogger as logger } from "../utils/loggers"
import { DatabaseSync } from "node:sqlite"
import type { AnyEvent } from "../types/eventTypes"
import cron from "node-cron"
import { tmpdir } from "node:os"
import { mkdir, rm } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { getS3Config, readStreams } from "./utils"

// this connects to the Redis stream and writes events to a SQLite database
/* redis stream -> sqlite -> json file -> duckdb table -> parquet in S3 */

const ac = new AbortController()
const { signal } = ac

function getTableName(stream: string) {
  return stream.replaceAll(/[^a-z]/ig, "_") + "_events"
}


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
    db.prepare(`SELECT timepoint FROM ${getTableName(stream)} ORDER BY timepoint DESC LIMIT 1`)
  )
}

/*
implement a batch job that runs nightly in sqlitePersistence.ts. it should move data from the sqlite database to parquet files on an s3 bucket. it should be scheduled for 2am every day with node-cron. it should query all events in each events table of the sqlite database and using duckdb, copy to parquet files on the s3 bucket. and then delete the rows from sqlite. do it in a transaction so that if upload fails, it will not delete the rows in sqlite. parse the event data using json_extract in duckdb. use the @duckdb/node-api package. store the files with file paths like /streamName/year=YYYY/month=MM/day=DD/<uuid>.parquet. pass the s3 credentials into duckdb from process.environment
 */

// Nightly export job setup


let exportUnderway = false

async function runNightlyExport() {
  console.log("Nightly export started")
  if (exportUnderway) {
    throw new Error(
      "Nightly export already underway, please wait until it finishes before starting another one"
    )
  }
  exportUnderway = true
  const s3 = getS3Config()
  const sqlitePath = process.env.SQLITE_DB_PATH ?? "/data/buffer.db"
  try {
    const { default: duck } = await import("@duckdb/node-api")
    const duckdbPath = process.env.DUCKDB_DB_PATH ?? "/data/duck.db"
    await rm(duckdbPath, { force: true, recursive: true }) // clean duckdb before we start. not needed to persist anything.
    const duckDb = await duck.DuckDBInstance.create(duckdbPath)
    const conn = await duckDb.connect()
    console.log("connected to duckdb")
    console.log("Memory usage:", process.memoryUsage().rss / 1024 / 1024, "MB")
    // Enable required extensions and credentials
    await conn.run("INSTALL httpfs; LOAD httpfs;")
    await conn.run("INSTALL sqlite; LOAD sqlite;")
    await conn.run(`CREATE OR REPLACE SECRET secret (
      TYPE s3,
      KEY_ID '${s3.accessKeyId}',
      SECRET '${s3.secretAccessKey}',
      ENDPOINT '${s3.endpoint}',
      REGION '${s3.region}'
    );`)
    await conn.run("SET memory_limit = '200MB';")
    await conn.run("SET threads = 1;")
    await conn.run(`SET preserve_insertion_order = false;`)
    // Attach SQLite database to duckdb
    await conn.run(`ATTACH '${sqlitePath}' AS sqlite_buffer (TYPE SQLITE, READ_ONLY);`)
    for (const streamPath of readStreams) {
      console.log("Memory usage:", process.memoryUsage().rss / 1024 / 1024, "MB")
      console.log("Processing", streamPath)
      const table = getTableName(streamPath)
      // Determine available dates (YYYY-MM-DD) from SQLite using SQLite directly for reliability
      //TODO: arguably this should be run by duckdb for consistency
      const daysStmt = db.prepare(`SELECT substr(published_at,1,10) AS day, COUNT(*) as events
                                   FROM ${table}
                                   GROUP BY day
                                   ORDER BY day ASC;`)
      const eventsPerDay = daysStmt.all()
      console.log("Determined available dates", eventsPerDay)

      const eventsInDayStmt = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE substr(published_at,1,10)=?`)

      const days = eventsPerDay.map((r: any) => r.day as string).slice(0, -1) // don't compact the most recent day
      for (const day of days) {
        console.log("Exporting day", day, streamPath)
        const s3Url = `s3://${s3.bucket}/${streamPath}`

        try {
          const eventCount = (eventsInDayStmt.get(day) as { count: number }).count
          console.log("Events in day", day, streamPath, eventCount)

          // copy json data from sqlite to a json file, using duckdb
          const tempDir = `${tmpdir()}/${randomUUID()}`
          await mkdir(tempDir, { recursive: true })
          const tempFile = `${tempDir}/${day}.json`
          // random sort to provide schema inference a different sample each day
          const tempFileResult = await conn.run(`
          COPY (
            SELECT event_data 
            FROM sqlite_buffer.${table} 
            WHERE date_trunc('day', published_at::TIMESTAMP)='${day}' 
            ORDER BY RANDOM()
          ) TO '${tempFile}' (FORMAT CSV, DELIMINATOR '\\n', HEADER false, QUOTE '', ESCAPE '', RETURN_FILES);
          `)
          console.log("Copied data to temp file", tempFile, (await tempFileResult.getRowObjects())[0])
          await scheduler.wait(500)
          const selectSql = `SELECT 
                                   date_trunc('day', event.published_at::TIMESTAMP) AS date,
                                   year(event.published_at::TIMESTAMP) AS year,
                                   month(event.published_at::TIMESTAMP) AS month,
                                   day(event.published_at::TIMESTAMP) AS day,
                                   *
                             FROM read_ndjson_auto('${tempFile}', auto_detect = true, sample_size = 20480)
                             ORDER BY event.timepoint ASC`

          // try copying to intermediate local table
          const tempTable = `${randomUUID()}_${table}`
          await conn.run(`CREATE OR REPLACE TABLE "${tempTable}" AS (${selectSql});`)
          console.log("Copied data to temp table", tempTable)
          await conn.run(`CHECKPOINT;`)
          await conn.run(`VACUUM;`)

          await scheduler.wait(1500) // get ready for the upload to S3

          const copySql = `COPY "${tempTable}" TO '${s3Url}' (FORMAT 'parquet', PARTITION_BY (year, month, day), FILENAME_PATTERN '{uuidv7}', APPEND, RETURN_STATS);`
          const copyResult = await conn.run(copySql)
          await conn.run(`DROP TABLE "${tempTable}";`)
          const copiedStats = await copyResult.getRowObjects()
          console.log("Copied data to parquet", copiedStats)
          await rm(tempDir, { force: true, recursive: true }) // clean up temporary json file
          const copiedRows = copiedStats.reduce((a, b) => a + Number(b.count), 0)
          console.log("Copied to S3", s3Url, copiedRows, "rows", eventCount, "events")
          if (copiedRows !== eventCount) throw new Error(`Copied ${copiedRows} rows but expected ${eventCount} rows`)
          try {
            db.exec("BEGIN TRANSACTION")
            const del = db.prepare(`DELETE FROM ${table} WHERE substr(published_at,1,10)=?`)
            console.log("Deleting rows from SQLite", day)
            const { changes } = del.run(day)
            console.log("Deleted", changes, "rows from SQLite", table, day)
            if (copiedRows === changes) {
              //only commit DELETE if it's the same number of rows as has been stored in S3
              db.exec("COMMIT")
              console.log(`Exported and deleted ${table} for day ${day} -> ${s3Url}`)
            } else {
              throw new Error(`Deleted ${changes} rows but copied ${copiedRows} rows`)
            }
          } catch (e) {
            db.exec("ROLLBACK")
            logger.error(e, "Failed to delete rows after upload; will retry next run")
          }
        } catch (error) {
          console.error("Failed to export day", day, streamPath, error)
          logger.error({ error, day, streamPath }, "Failed to export day")
          // Intentionally do not throw to continue with other days/streams
        }
      }
    }

    conn.closeSync()
    duckDb.closeSync()
    console.error("Nightly finished")
    db.exec("VACUUM;") // clean up after mass deletes. shrinks file size on disk.
  } catch (e) {
    console.error("Nightly export failed:", e)
  } finally {
    exportUnderway = false
  }
}

// Schedule at 2am server local time daily
cron.schedule("0 2 * * *", () => {
  runNightlyExport().catch(err => console.error("Nightly export error:", err))
})
await runNightlyExport() //run on startup

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
    // if there were less than 1000 events, sleep for 60 seconds before reading again
    const totalEvents = events?.flatMap(({ messages }) => messages).length ?? 0
    const waitDuration = totalEvents >= 1000 ? 5_000 : 60_000
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

// Nightly compaction job: move events from SQLite to Parquet on S3 at 2am daily using DuckDB.