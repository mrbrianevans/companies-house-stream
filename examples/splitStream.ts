import split2 from "split2"
import { get, RequestOptions } from "https"

/*

Minimal working example of connecting to a stream, and printing out the events.

 */

/**
 * Connect to a stream, parse the events JSON.
 * @param streamPath - the url path to the stream. Eg 'filings' or 'companies' etc.
 * @param callback - function to be called with each event as the argument.
 * @param startFromTimepoint - (optional) a timepoint to begin from. If omitted then streams starts at latest event.
 */
export async function splitStream<EventType>(streamPath = "filings", callback: (e: EventType) => void = console.log, startFromTimepoint?: number) {
  const auth = process.env.STREAM_KEY1 + ":"
  const path = "/" + streamPath + (typeof startFromTimepoint === "number" ? `?timepoint=${startFromTimepoint}` : "")
  const options: RequestOptions = { hostname: "stream.companieshouse.gov.uk", path, auth }
  get(options, (res) => {
    if (res.statusCode === 200) res.pipe(split2(JSON.parse)).on("data", callback)
    else res.pipe(process.stdout)
    res.on("end", () => console.log("Stream ended. 'end' event triggered"))
  }).end()
}


await splitStream()
