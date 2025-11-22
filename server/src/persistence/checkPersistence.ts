// This file is to check and evaluate the quality of the data persisted in S3

// Query the s3 bucket to see how complete the data is, based on timepoints of events and number of events per day.

import { DuckDBDateValue, DuckDBInstance, DuckDBValue } from "@duckdb/node-api"
import { getS3Config, readStreams } from "./utils"

async function checkPersistence() {
  const duckdbPath = ":memory:"
  const duckDb = await DuckDBInstance.create(duckdbPath)
  const conn = await duckDb.connect()
  await conn.run("INSTALL httpfs; LOAD httpfs;")
  const s3 = getS3Config()
  await conn.run(`CREATE OR REPLACE SECRET secret (
      TYPE s3,
      KEY_ID '${s3.accessKeyId}',
      SECRET '${s3.secretAccessKey}',
      ENDPOINT '${s3.endpoint}',
      REGION '${s3.region}'
    );`)

  for (const streamPath of readStreams) {
    const s3Url = `s3://${s3.bucket}/${streamPath}/*/*/*/*.parquet`
    const result = await conn.run(`
        SELECT year,
               month,
               day,
               make_date(year, month, day)                     AS date,
               COUNT(*)                                        AS count,
               MIN(event.timepoint)                            AS min_timepoint,
               MAX(event.timepoint)                            AS max_timepoint,
               MAX(event.timepoint) - MIN(event.timepoint) + 1 AS timepoint_difference
        FROM read_parquet('${s3Url}', hive_partitioning = true)
        GROUP BY year, month, day
        ORDER BY year, month, day ASC
        ;
    `)

    interface ResultStat extends Record<string, DuckDBValue> {
      date: DuckDBDateValue,
      count: bigint,
      min_timepoint: bigint,
      max_timepoint: bigint,
      timepoint_difference: bigint
    }

    const rows = await result.getRowObjects() as ResultStat[]
    console.log(streamPath, "Number of days", rows.length)
    let lastTimepoint
    let correctEvents = 0n
    for (const row of rows) {
      const date = row.date.toString()
      correctEvents += row.count
      if (row.count !== row.timepoint_difference) {
        correctEvents = 0n
        if (row.count % row.timepoint_difference === 0n) {
          console.log(streamPath, "Duplicate files detected for ", date)
        } else if (row.count < row.timepoint_difference) {
          console.log(streamPath, "Missing events in file", date)
        } else if (row.count > row.timepoint_difference) {
          console.log(streamPath, "Duplicate events in file", date)
        }
      }
      if (lastTimepoint) {
        const expectedMin = lastTimepoint + 1n
        if (row.min_timepoint > expectedMin) {
          // this could also be overlap rather than missing.
          console.log(streamPath, "Missing events between days", date, lastTimepoint, "->", row.min_timepoint)
          correctEvents = 0n
        } else if (row.min_timepoint < expectedMin) {
          console.log(streamPath, "Has overlapping events", date, lastTimepoint, "->", row.min_timepoint)
          correctEvents = 0n
        }
      }
      lastTimepoint = row.max_timepoint
    }
    console.log(streamPath, "Total correct events", correctEvents)
  }
}


await checkPersistence()