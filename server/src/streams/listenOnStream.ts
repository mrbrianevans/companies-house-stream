import type { RequestOptions } from "https"
import { request } from "https"
import { streamKeyHolder } from "../utils/KeyHolder.js"
import pino from "pino"
import { CustomJsonParse } from "./jsonParseStream.js"

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
