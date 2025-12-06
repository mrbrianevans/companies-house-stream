import { getS3Config } from "./utils"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { createWriteStream } from "node:fs"
import { readFile } from "node:fs/promises"

const s3Config = getS3Config()

const s3 = new S3Client({
  region: s3Config.region,
  endpoint: s3Config.endpoint,
  credentials: {
    accessKeyId: s3Config.accessKeyId ?? "",
    secretAccessKey: s3Config.secretAccessKey ?? ""
  }
})
const Bucket = s3Config.bucket
const Key = "events.ducklake"

export async function downloadDucklake() {
  try {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket, Key }))
    if (!Body) throw new Error("No ducklake found at " + Key)
    const stream = Readable.fromWeb(Body.transformToWebStream())
    const outputName = "/data/events.ducklake"
    await pipeline(stream, createWriteStream(outputName))
    return outputName
  } catch (e: any) {
    if (e.name === "NoSuchKey") throw new Error("No ducklake found at " + Key)
    else throw new Error("Failed to download ducklake", { cause: e })
  }
}

export async function uploadDucklake(localPath: string) {
  const fileBuffer = await readFile(localPath)
  //TODO: if the ducklake catalogue gets big, considering using a streaming multipart upload
  const response = await s3.send(new PutObjectCommand({
    Bucket,
    Key,
    Body: fileBuffer
  }))
  console.log("Uploaded ducklake with etag:", response.ETag, "to", `s3://${Bucket}/${Key}`)
}