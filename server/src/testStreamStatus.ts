import { streamKeyHolder } from "./utils/KeyHolder"
import { request, RequestOptions } from "https"
import { parse } from "JSONStream"
import "dotenv/config"
import { stream } from "./streams/listenOnStream"
import { performance } from "perf_hooks"

streamKeyHolder.addKey(process.env.STREAM_KEY1)

function listenToStream(path = "companies", callback: (e) => void = console.log) {
  const streamKey = streamKeyHolder.useKey()
  const options: RequestOptions = {
    hostname: "stream.companieshouse.gov.uk",
    port: 443,
    path: "/" + path,
    method: "GET",
    auth: streamKey + ":"
  }

  const handleError = (e: Error) => console.error(`Error on ${path} stream`, "\x1b[31m", e.message, "\x1b[0m")
  console.time("Request " + path)
  request(options, (res) => {
    console.timeLog("Request " + path, "responded with STATUS", res.statusCode, res.statusMessage)
    console.timeEnd("Request " + path)
    res.pipe(parse()).on("data", callback).on("error", handleError).on("end", () => streamKeyHolder.disuseKey(streamKey))
  })
    .on("error", handleError)
    .end()
}


// connects to the filing stream to test that its working, separate from the other application logic.
listenToStream("filings", () => console.log("Event received", Date()))


// const events = stream('filings')
// for await (const d of events){
//   const received = performance.timeOrigin + performance.now()
//   console.log(d.resource_kind, d.resource_id, received - d.received, 'ms latency')
// }
