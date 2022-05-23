import { CustomJsonParse } from "./jsonParseStream.js"

/**
 * Run this in terminal to print out the objects from a stream:
 * curl --user APIKEY: -s https://stream.companieshouse.gov.uk/filings | node dist/streams/streamCmdLine.js
 */

process.stdin.pipe(new CustomJsonParse({})).on("data", console.log)
