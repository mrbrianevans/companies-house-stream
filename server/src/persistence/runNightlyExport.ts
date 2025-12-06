import { getS3Config, getTableName, readStreams } from "./utils"
import { mkdir, rm } from "node:fs/promises"
import { BIGINT, DuckDBListValue } from "@duckdb/node-api"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { statSync } from "fs"
import { scheduler } from "node:timers/promises"
import { streamFromRedisLogger as logger } from "../utils/loggers"
import { DatabaseSync } from "node:sqlite"
import { downloadDucklake, uploadDucklake } from "./ducklake"

const maintainDucklake = false

// Nightly compaction job: move events from SQLite to Parquet on S3 using DuckDB.
export async function runNightlyExport(db: DatabaseSync) {
  const s3 = getS3Config()
  const sqlitePath = process.env.SQLITE_DB_PATH ?? "/data/buffer.db"

  const { default: duck } = await import("@duckdb/node-api")
  const duckdbPath = process.env.DUCKDB_DB_PATH ?? "/data/duck.db"
  await rm(duckdbPath, { force: true, recursive: true }) // clean duckdb before we start. not needed to persist anything.
  const ducklakePath = maintainDucklake ? await downloadDucklake() : undefined
  const duckDb = await duck.DuckDBInstance.create(duckdbPath)
  const conn = await duckDb.connect()
  console.log("connected to duckdb")
  console.log("Memory usage:", process.memoryUsage().rss / 1024 / 1024, "MB")
  // Enable required extensions and credentials
  await conn.run("INSTALL httpfs; LOAD httpfs;")
  await conn.run("INSTALL sqlite; LOAD sqlite;")
  if (maintainDucklake)
    await conn.run("INSTALL ducklake; LOAD ducklake;")
  await conn.run(`CREATE OR REPLACE SECRET secret (
      TYPE s3,
      KEY_ID '${s3.accessKeyId}',
      SECRET '${s3.secretAccessKey}',
      ENDPOINT '${new URL(s3.endpoint ?? "https://s3.amazonaws.com").hostname}',
      REGION '${s3.region}'
    );`)
  await conn.run("SET memory_limit = '1024MB';")
  await conn.run("SET threads = 1;")
  await conn.run(`SET preserve_insertion_order = true;`)

  // Attach SQLite database to duckdb
  await conn.run(`ATTACH '${sqlitePath}' AS sqlite_buffer (TYPE SQLITE, READ_ONLY);`)

  // Attach ducklake
  if (maintainDucklake)
    await conn.run(`ATTACH 'ducklake:${ducklakePath}' AS ducklake;`)

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

                // Add to the ducklake
                if (maintainDucklake) {
                  await conn.run(`CALL ducklake_add_data_files('ducklake', '${table}', '${uploadedFile.filename}', ignore_extra_columns => true, allow_missing => true);`)
                  console.log("Added", uploadedFile.filename, "to ducklake", table)
                }
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

  if (maintainDucklake)
    await conn.run(`DETACH ducklake;`)
  
  conn.closeSync()
  duckDb.closeSync()

  if (maintainDucklake && ducklakePath)
    await uploadDucklake(ducklakePath)

  console.error("Nightly finished")
  db.exec("VACUUM;") // clean up after mass deletes. shrinks file size on disk.

}