import { request, RequestOptions } from "https"
import { parse } from "JSONStream"


function listenToStream(path = "companies", callback: (e) => void = console.log) {
  const streamKey = process.env.STREAM_KEY1
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
    res.pipe(parse()).on("data", callback).on("error", handleError)
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
