import type { RequestOptions } from "https"
import { request } from "https"
import type { CompanyProfileEvent, PscEvent } from "../types/eventTypes"
import { parse } from "JSONStream"
import { PassThrough, Stream, Transform } from "stream"
import { streamKeyHolder } from "../utils/KeyHolder"
import { performance } from "perf_hooks"
import pino from "pino"
import { CustomJsonParse } from "./jsonParseStream"

export type StreamPath =
  | "insolvency-cases"
  | "companies"
  | "filings"
  | "charges"
  | "persons-with-significant-control"
  | "officers"
  | "disqualified-officers"
  | string

/**
 * Listens to a HTTPS stream of events from companies house on `path`, and calls `callback` with each one.
 * @param path - URL path to listen on. Defaults to `companies`. Can be `filings` or `persons-with-significant-control` etc.
 * @param callback - function to call on each event. Will call with the event data as the only parameter.
 * @param startFromTimepoint - timepoint to start from. If omitted, then will start from the latest event.
 * @deprecated - use stream() instead, due to better handling of errors and disconnecting.
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


/**
 * Returns a readable stream of events. The recommended way of listening to a stream in this application.
 */
export function stream<EventType>(streamPath: StreamPath, startFromTimepoint?: number) {
  const logger = pino({ base: { streamPath } })
  const streamKey = streamKeyHolder.useKey()
  const timepointQueryString = typeof startFromTimepoint === "number" ? `?timepoint=${startFromTimepoint}` : ""
  const path = "/" + streamPath + timepointQueryString
  const options: RequestOptions = {
    hostname: "stream.companieshouse.gov.uk", port: 443, path, auth: streamKey + ":"
  }
  const parser = new CustomJsonParse({}, true)
  const handleError = (message: string) => (e: Error) => {
    if (e) {
      logger.error(e, message)
    }
    streamKeyHolder.disuseKey(streamKey) // relinquish key when stream closes
    logger.info("stream ended")
    parser.end() // end the passthrough stream as well
  }
  parser.on("error", handleError("Error on parser stream"))
  logger.info({ path }, "Requesting to connect to stream")
  request(options, (res) => {
    const { statusMessage, statusCode } = res
    logger.info({ path, res: { statusMessage, statusCode } }, "Response received from stream")
    switch (res.statusCode) {
      case 429:
        logger.fatal("Exiting due to hitting rate limit")
        process.exit(res.statusCode)
        break
      case 416:
        logger.error("Timepoint out of range. Try without a timepoint.")
        break
      case 200:
        logger.info("Stream started successfully, piping through json parser")
        res.pipe(parser)
        break
      default:
        res.pipe(process.stdout)
        handleError("Non 200 status code response received")
        break
    }
    res.on("end", handleError("Stream ended. 'end' event triggered"))
      .on("error", handleError("error on response stream"))
  })
    .on("error", handleError("Error on request"))
    .end()
  return parser
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
