import { DuckDBInstance } from "@duckdb/node-api"
import { getS3Config, getTableName, readStreams } from "./utils"
import { uploadDucklake } from "./ducklake"
import { existsSync } from "node:fs"


const duckdbPath = ":memory:"
const ducklakePath = "events.ducklake"
const duckDb = await DuckDBInstance.create(duckdbPath)
const conn = await duckDb.connect()
await conn.run("INSTALL httpfs; LOAD httpfs;")
await conn.run("INSTALL ducklake; LOAD ducklake;")
const s3 = getS3Config()
await conn.run(`CREATE OR REPLACE SECRET secret (
      TYPE s3,
      KEY_ID '${s3.accessKeyId}',
      SECRET '${s3.secretAccessKey}',
      ENDPOINT '${s3.endpoint}',
      REGION '${s3.region}'
    );`)
await conn.run(`ATTACH 'ducklake:${ducklakePath}' AS ducklake;`)
await conn.run("USE ducklake;")

for (const streamPath of readStreams) {
  const s3Url = `s3://${s3.bucket}/stream=${streamPath}/resource_kind=*/uploaded_day=*/*.parquet`
  console.log("S3 files", s3Url)
  const table = getTableName(streamPath)
  const localParquet = table + ".parquet"
  if (!existsSync(localParquet)) {
    console.time("Copy to local parquet " + localParquet)
    await conn.run(`COPY (FROM read_parquet
           (
                           '${s3Url}',
                           hive_partitioning = false,
                           union_by_name = false
           ) USING SAMPLE 1000) TO '${localParquet}';`)
    console.timeEnd("Copy to local parquet " + localParquet)
  }

  console.time("Create " + table)
  await conn.run(`
      CREATE TABLE IF NOT EXISTS ${table} AS
      SELECT *
      FROM ${localParquet} WITH NO DATA;
  `)
  console.timeEnd("Create " + table)

  console.time("Load existing files " + streamPath)
  //This failed with
  // error: TransactionContext Error: Failed to commit: Failed to commit DuckLake transaction: Failed to cast value: Could not convert string '2025-12-02' to INT64
  await conn.run(`CALL ducklake_add_data_files('ducklake', '${table}', '${s3Url}', allow_missing => true, ignore_extra_columns => true);`)
  console.timeEnd("Load existing files " + streamPath)
  break
}
await conn.run(`DETACH ducklake;`)
conn.closeSync()
duckDb.closeSync()

console.log("Ducklake created. Uploading")
await uploadDucklake(ducklakePath)