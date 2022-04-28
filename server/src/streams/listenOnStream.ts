import type { RequestOptions } from "https"
import { request } from "https"
import type { CompanyProfileEvent, PscEvent } from "../types/eventTypes"
import { parse } from "JSONStream"
import { PassThrough, Transform } from "stream"
import { streamKeyHolder } from "../utils/KeyHolder"

type StreamPath =
  | "insolvency-cases"
  | "companies"
  | "filings"
  | "charges"
  | "persons-with-significant-control"
  | "officers"
  | string

/**
 * Listens to a HTTPS stream of events from companies house on `path`, and calls `callback` with each one.
 * @param path - URL path to listen on. Defaults to `companies`. Can be `filings` or `persons-with-significant-control` etc.
 * @param callback - function to call on each event. Will call with the event data as the only parameter.
 * @param startFromTimepoint - timepoint to start from. If omitted, then will start from the latest event.
 */
export function listenToStream<EventType extends {
  resource_id: string
} = CompanyProfileEvent.CompanyProfileEvent>(path: StreamPath = "companies", callback: (e: EventType) => void = console.log, startFromTimepoint?: number) {
  const streamKey = streamKeyHolder.useKey()
  const timepointQueryString = typeof startFromTimepoint === "number" ? `?timepoint=${startFromTimepoint}` : ""
  const options: RequestOptions = {
    hostname: "stream.companieshouse.gov.uk",
    port: 443,
    path: "/" + path + timepointQueryString,
    method: "GET",
    auth: streamKey + ":"
  }

  const handleError = (e: Error) => console.error(`Error on ${path} stream`, "\x1b[31m", e.message, "\x1b[0m")
  console.time("Request " + path)
  request(options, (res) => {
    console.timeEnd("Request " + path)
    console.log(path, "responded with STATUS", res.statusCode, res.statusMessage)
    // res.on("data", b => console.log("response body", b.toString()));
    res.pipe(parse()).on("data", callback).on("error", handleError)
  })
    .on("error", handleError)
    .end()
}

// listenToStream('persons-with-significant-control')

/**
 * Returns a readable stream of events.
 */
export function stream<EventType>(path: StreamPath) {
  const streamKey = streamKeyHolder.useKey()
  const options: RequestOptions = {
    hostname: "stream.companieshouse.gov.uk", port: 443, path: "/" + path, auth: streamKey + ":"
  }
  const pass = new PassThrough({ objectMode: true })
  const handleError = (e: Error) => console.error(`Error on ${path} stream generator`, "\x1b[31m", e.message, "\x1b[0m")
  request(options, (res) => {
    console.log(path, "responded with STATUS", res.statusCode, res.statusMessage)
    if (res.statusCode === 429) process.exit(res.statusCode)
    // res.on("data", b => console.log("response body", b.toString()));
    res.pipe(parse()).on("error", handleError).pipe(pass)
    res.on("close", () => {
      streamKeyHolder.disuseKey(streamKey) // relinquish key when stream closes
      console.log(path, "stream ended", Date())
    })
  })
    .on("error", handleError)
    .end()
  return pass
}

/**
 * Returns an async iterator of events.
 * @param path
 */
export async function* streamGenerator<EventType>(path: StreamPath): AsyncGenerator<EventType> {
  for await (const s of stream(path)) {
    yield s
  }
  return
}

async function runStream() {
  for await (const s of streamGenerator<PscEvent.PscEvent>("persons-with-significant-control")) {
    console.log("event received: ", s)
  }
}

// while(true){
//   runStream();
//   await new Promise(resolve => setTimeout(resolve, 60_000)) // 1min
// }

// would like to make my own Transform stream to parse the JSON, but it isn't working
class customJsonParse extends Transform {
  private data: string

  constructor(callback) {
    super({ decodeStrings: false })
    this.data = ""
    callback()
  }

  transform(chunk, encoding, callback) {
    this.data += chunk
    callback()
  }

  flush(callback) {
    try {
      // Make sure is valid json.
      JSON.parse(this.data)
      this.push(this.data)
      callback()
    } catch (err) {
      callback(err)
    }
  }
}
