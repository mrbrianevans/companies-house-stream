import { JSONParser } from "@streamparser/json-node"
import { Client } from "undici"
import "dotenv/config"

/** Get an environment variable, or throw if its not set */
export function getEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined)
    throw new Error(`${name} environment variable not set`)
  return value
}

const parser = new JSONParser({ paths: ["$"], separator: "" })
parser.on("data", ({ value }) => console.log("Chunk:", value))
parser.on("error", err => console.error("ERROR:", err))
parser.on("end", () => console.log("Stream ended"))

const client = new Client(`https://stream.companieshouse.gov.uk`)
await client.stream({
  path: "/filings",
  method: "GET",
  headers: {
    "Authorization": "Basic " + Buffer.from(getEnv("STREAM_KEY1") + ":").toString("base64")
  }
}, (res) => {
  console.log("Status code", res.statusCode)
  return parser
})

