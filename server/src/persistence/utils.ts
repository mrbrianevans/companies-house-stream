export function getS3Config() {
  return {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || "auto",
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT
  }
}

// Streams we read from Redis (subset of all known stream paths)
export const readStreams = [
  "officers",
  "persons-with-significant-control",
  "charges",
  "insolvency-cases",
  "disqualified-officers"
]