import split2 from "split2"

/**
 * Run this in terminal to print out the objects from a stream:
 * curl --user APIKEY: -s https://stream.companieshouse.gov.uk/filings | node dist/streams/streamCmdLine.js
 */

process.stdin.pipe(split2(JSON.parse)).on("data", console.log)
