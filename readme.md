# Companies Stream

This project is a visualiser of changes made to the Companies House database of UK companies. It
shows events as they happen in realtime, such as a new company registering, or a company going
insolvent.

## Technology

- [NodeJS](https://nodejs.org) server with [express](https://www.npmjs.com/package/express)
- [WebSockets](https://javascript.info/websocket)
- HTML frontend with pure JavaScript and CSS

## How it works

The Node server makes requests to the companies house server, which sends a response each time there is an event.

The frontend client connects to the server via a WebSocket, on which the server sends events when they are received.
The client displays these events in HTML.


## Make your own

If you are interested in using the companies house streaming API,
visit [developer-specs.company-information.service.gov.uk](https://developer-specs.company-information.service.gov.uk/streaming-api/guides/overview "Companies house developer website")
to create an account for a free API key. The API base url is https://stream.companieshouse.gov.uk
with endpoints `/companies`, `/filings`, `/officers`, `persons-with-significant-control`, `/charges`
and `/insolvency-cases`

Here is a minimum working example using TypeScript:

```typescript
import { request, RequestOptions } from "https"
import { parse } from "JSONStream" // requires npm i JSONStream to parse JSON events

const streamKey = process.env.STREAM_KEY // API key from Companies House website
const options: RequestOptions = {
  hostname: "stream.companieshouse.gov.uk",
  port: 443,
  path: "/filings", // change this depending on which stream you want
  method: "GET",
  auth: streamKey + ":"
}

const handleError = (e: Error) => console.error(`Error on stream`, "\x1b[31m", e.message, "\x1b[0m")

request(options, (res) => {
  if (res.statusCode === 200) console.log("Stream opened at", Date())
  else console.log('Stream could not open:', res.statusCode, res.statusMessage)
  res.pipe(parse())
    .on("data", event => console.log('Event received:', event))
    .on("error", handleError)
    .on("end", () => console.log('Stream ended at', Date()))
})
  .on("error", handleError)
  .end() // this sends the request

```

For a more complete example of listening on a stream, as well as some more options of how to integrate it with
NodeJS streams,
see [server/src/streams/listenOnStream.ts](https://github.com/mrbrianevans/companies-house-stream/blob/master/server/src/streams/listenOnStream.ts)
.

# Connection limits

Companies House currently only allows each API key to authorise 2 streams at a time, but there are 6 streams in total.

To get around this limitation and connect to all 6 streams at the same time, I created the KeyHolder class
in `server/src/utils`.
This takes 3 API keys and assigns one to each stream to ensure that each key is only used to authorise 2 streams at a
time.

# Questions?

If you have any questions or suggestions please open an issue on the repository, and I will get back to you.

## Using this code

You are welcome to use this open source code for your own projects.
See the [LICENSE](https://github.com/mrbrianevans/companies-house-stream/blob/master/LICENSE) file for more information.
