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
import { BIGINT, DuckDBListValue, INTEGER, VARCHAR } from "@duckdb/node-api"
import { statSync } from "fs"
import { error } from "elysia"

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
    await conn.run("SET memory_limit = '1024MB';")
    await conn.run("SET threads = 1;")
    await conn.run(`SET preserve_insertion_order = true;`)

    // Attach SQLite database to duckdb
    await conn.run(`ATTACH '${sqlitePath}' AS sqlite_buffer (TYPE SQLITE, READ_ONLY);`)

    for (const streamPath of readStreams) {
      console.log("Memory usage:", process.memoryUsage().rss / 1024 / 1024, "MB")
      console.log("Processing", streamPath)
      const table = getTableName(streamPath)
      // ignores published_at since events can be republished and may be out of order.
      const eventsPerDayResult = await conn.run(`
          SELECT substr(published_at::VARCHAR, 1, 10) AS day,
                 COUNT(*)                             as events,
                 MAX(timepoint)                       AS max_timepoint,
                 MIN(timepoint)                       AS min_timepoint
          FROM sqlite_buffer.${table}
          GROUP BY day
          ORDER BY max_timepoint ASC;`)
      const eventsPerDay = await eventsPerDayResult.getRowObjects()
      console.log("Determined available dates", eventsPerDay)

      const lastDay = eventsPerDay.at(-1)
      console.log(streamPath, "Processing events up to", lastDay)
      if (lastDay) {
        try {
          const today = new Date().toISOString().slice(0, 10)
          const eventsInDayDuck = await conn.runAndReadAll(`
              SELECT COUNT(*)       AS count,
                     MIN(timepoint) AS min,
                     MAX(timepoint) AS max
              FROM sqlite_buffer.${table}
              WHERE timepoint < $min_timepoint;
          `, { min_timepoint: lastDay.min_timepoint }, { min_timepoint: BIGINT })
          const eventsInDayResult = eventsInDayDuck.getRowObjects()[0]
          const eventCount = Number((eventsInDayResult).count)
          const minTimepoint = Number((eventsInDayResult).min)
          const maxTimepoint = Number((eventsInDayResult).max)
          const timepointDifference = maxTimepoint - minTimepoint

          if (!eventCount) {
            console.log("No events to process. Skipping.", streamPath)
            continue
          }

          console.log("Events to process", streamPath, eventsInDayResult)

          if (eventCount !== timepointDifference + 1) {
            console.error("Wrong number of events for the timepoint difference", streamPath)
            console.error(streamPath, { timepointDifference, eventCount })
          }

          // partition by resource_kind
          const resourceKindCountsQuery = await conn.runAndReadAll(`
              SELECT event_data ->> '$.resource_kind' AS resource_kind, COUNT(*) AS count
              FROM sqlite_buffer.${table}
              WHERE timepoint >= ${minTimepoint}
                AND timepoint <= ${maxTimepoint}
              GROUP BY resource_kind;
              ;
          `)
          const resourceKindCounts = resourceKindCountsQuery.getRowObjects() as {
            resource_kind: string,
            count: number
          }[]
          console.log(streamPath, "Resource kind counts", resourceKindCounts)
          for (const { resource_kind } of resourceKindCounts) {
            // consider beginning a transaction for each resource_kind. might only benefit if duckdb can do the delete.
            // unique temp dir for each resource_kind
            const tempDir = `${tmpdir()}/${randomUUID()}_${resource_kind}`
            // copy json data from sqlite to json files, using duckdb
            await mkdir(tempDir, { recursive: true })
            try {
              const filePartSize = "25MB" // ensures that we can infer the schema of the whole file without OOM
              const tempFileCopy = await conn.run(`
          COPY (
            SELECT event_data 
            FROM sqlite_buffer.${table} 
            WHERE timepoint >= ${minTimepoint} AND timepoint <= ${maxTimepoint} AND (event_data::JSON->>'$.resource_kind') = '${resource_kind}'
            ORDER BY timepoint ASC
          ) TO '${tempDir}' (FORMAT CSV, DELIMINATOR '\\n', HEADER false, QUOTE '', ESCAPE '', FILE_SIZE_BYTES '${filePartSize}', FILENAME_PATTERN '${resource_kind}_part{i}', FILE_EXTENSION 'json', RETURN_FILES);
          `)
              const tempFilesResult = (await tempFileCopy.getRowObjects())[0]
              console.log("Copied data to temp dir", tempDir, tempFilesResult)
              const jsonFiles = (tempFilesResult.Files as DuckDBListValue)?.items ?? []

              let rowsUploadedForResourceKind = 0

              for (const tempFile of jsonFiles) {
                console.log("local json file", tempFile)

                const stats = statSync((tempFile as string))
                if (stats.size < 10) {
                  console.log("skipping small file", tempFile, stats.size)
                  continue
                }

                await scheduler.wait(500)
                const selectSql = `SELECT *
                                   FROM read_ndjson_auto('${tempFile}', auto_detect = true, sample_size = -1)
                `
                // copy to intermediate local table in duckdb
                const tempTable = `${randomUUID()}_${table}`
                await conn.run(`CREATE OR REPLACE TABLE "${tempTable}" AS (${selectSql});`)
                console.log("Copied data to temp table", tempTable)

                const minMaxTempTableQuery = await conn.runAndReadAll(`SELECT MIN(event.timepoint) AS min, MAX(event.timepoint) AS max
                                                                       FROM "${tempTable}";`)
                const minMaxTempTable = minMaxTempTableQuery.getRowObjects()[0] as { min: number, max: number }
                const s3Url = `s3://${s3.bucket}/stream=${streamPath}/resource_kind=${resource_kind}/uploaded_day=${today}/min_${minMaxTempTable.min}-max_${minMaxTempTable.max}.parquet`

                await scheduler.wait(500) // get ready for the upload to S3
                //Path in S3 is /streamName=officers/resource_kind=company-officers/uploaded_day=YYYY-MM-DD/min_timepoint-max_timepoint.parquet
                // copy to s3 parquet
                const copySql = `COPY "${tempTable}" TO '${s3Url}' (FORMAT 'parquet', RETURN_STATS);`
                const copyResult = await conn.run(copySql)
                await conn.run(`DROP TABLE "${tempTable}";`)
                const copiedStats = await copyResult.getRowObjects()
                console.log("Copied data to parquet", copiedStats[0].count, copiedStats[0].filename)
                for (const uploadedFile of copiedStats) {
                  const uploadedRangeResult = await conn.runAndReadAll(`
                      SELECT COUNT(*)               AS count,
                             MIN(event.timepoint)   AS min,
                             MAX(event.timepoint)   AS max,
                             max - min              AS difference,
                             difference + 1 = count AS matches
                      FROM '${uploadedFile.filename}';
                  `)
                  const uploadedRange = uploadedRangeResult.getRowObjects()[0]
                  console.log("File uploaded with stats", uploadedRange)

                  // TODO: here delete from sqlite for this successful upload. if it can't delete, remove the uploaded file from s3.
                }

                const copiedRows = copiedStats.reduce((a, b) => a + Number(b.count), 0)
                rowsUploadedForResourceKind += copiedRows
              }
              console.log("Copied to S3", rowsUploadedForResourceKind, "rows")

              try {
                db.exec("BEGIN TRANSACTION")
                // would be good if duckdb could do the delete, but requires a write lock on sqlite.
                const del = db.prepare(`DELETE
                                        FROM ${table}
                                        WHERE timepoint >= ?
                                          AND timepoint <= ?
                                          AND (event_data ->> '$.resource_kind') = ?`)
                console.log("Deleting rows from SQLite", resource_kind, minTimepoint, maxTimepoint)
                const { changes } = del.run(minTimepoint, maxTimepoint, resource_kind)
                console.log("Deleting", changes, "rows from SQLite", table, resource_kind, minTimepoint, maxTimepoint)
                if (rowsUploadedForResourceKind === changes) {
                  //only commit DELETE if it's the same number of rows as has been stored in S3
                  db.exec("COMMIT")
                  console.log(`Exported and deleted ${table} for resource_kind ${resource_kind} -> s3`)
                } else {
                  throw new Error(`Deleted ${changes} rows but copied ${rowsUploadedForResourceKind} rows`)
                }
              } catch (e) {
                logger.error(e, "Failed to delete rows after upload; will retry next run causing duplicates in S3", e)
                db.exec("ROLLBACK")
                //TODO: clean up s3 path if upload succeeded
              }
            } catch (e) {
              console.error("Failed to export resource_kind", resource_kind, e)
            } finally {
              await rm(tempDir, { force: true, recursive: true }) // clean up temporary json file
              await conn.run("CHECKPOINT;")
            }
          }
        } catch (error) {
          console.error("Failed to export stream", streamPath, error)
          logger.error({ error, streamPath }, "Failed to export day")
          // Intentionally do not throw to continue with other resource_kinds/streams
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

// Schedule at 2am server local time daily. could be run more often during times of bulk loading by CH.
cron.schedule("0 2 * * *", () => {
  runNightlyExport().catch(err => console.error("Nightly export error:", err))
})
await runNightlyExport() //run on startup

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

// Nightly compaction job: move events from SQLite to Parquet on S3 at 2am daily using DuckDB.