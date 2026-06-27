import type { RequestOptions } from "https"
import { request } from "https"
import { streamKeyHolder } from "../utils/KeyHolder.js"
import pino from "pino"
import { CustomJsonParse } from "./jsonParseStream.js"
import { Readable } from "node:stream"
import { redisClient } from "../utils/getRedisClient"
import { type } from "node:os"

export type StreamPath =
  | "insolvency-cases"
  | "companies"
  | "filings"
  | "charges"
  | "persons-with-significant-control"
  | "officers"
  | "disqualified-officers"
  | string
const BASE_URL = 'stream.companieshouse.gov.uk'
interface ResponseLogEventBase extends Record<string, string> {
correlationId: string,
  type: 'response_started'|'response_ended'
  timestamp: string,
  stream: StreamPath
}
interface ResponseStartedLogEvent extends ResponseLogEventBase {
  type: 'response_started'
  urlPath: string,
  status: string,
  headersObject:string,
  requestedTimepoint: string,
  ttfb_ms: string
  base_url: string
}
interface ResponseEndedLogEvent extends ResponseLogEventBase {
  type: 'response_ended',
}
type ResponseLogEvent = ResponseStartedLogEvent | ResponseEndedLogEvent

const logResponse = (event: ResponseLogEvent) => redisClient.xAdd("ch:responses", "*", event, {
  TRIM: {
    strategy: "MAXLEN",
    threshold: 1000,
    strategyModifier: "~"
  }
})

/**
 * Returns a readable stream of events. The recommended way of listening to a stream in this application.
 */
export function stream<EventType>(streamPath: StreamPath, startFromTimepoint?: number): Readable {
  const correlationId = crypto.randomUUID()
  const logger = pino({ base: { streamPath, correlationId } })
  const streamKey = streamKeyHolder.useKey()
  const timepointQueryString = typeof startFromTimepoint === "number" ? `?timepoint=${startFromTimepoint}` : ""
  const path = "/" + streamPath + timepointQueryString
  const options: RequestOptions = {
    hostname: BASE_URL, port: 443, path, auth: streamKey + ":"
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
  const requestTime = Date.now()
  request(options, (res) => {
    const ttfbMs = Date.now() - requestTime
    const { statusMessage, statusCode } = res
    logger.info({ path, res: { statusMessage, statusCode } }, "Response received from stream")
    logResponse({
      headersObject: JSON.stringify(res.headers),
      status: statusCode?.toString() ?? '',
      ttfb_ms: ttfbMs.toString(),
      urlPath: path,
      base_url: 'https://'+BASE_URL,
      stream: streamPath, type: 'response_started', correlationId, timestamp: new Date().toISOString(), requestedTimepoint: startFromTimepoint?.toString()??'' })
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
        res.pipe(parser, { end: true })
        break
      default:
        res.pipe(process.stdout)
        handleError("Non 200 status code response received")
        break
    }
    res.on("end", (err:any) => {
      logResponse({
        type: 'response_ended',
        correlationId,
        timestamp: new Date().toISOString(),
        stream: streamPath
      });
      handleError("Stream ended. 'end' event triggered")(err);
    })
      .on("error", handleError("error on response stream"))
  })
    .on("error", handleError("Error on request"))
    .end()
  return parser
}
