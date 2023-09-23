# Companies Stream

This project is a visualiser of changes made to the Companies House database of UK companies. It
shows events as they happen in realtime, such as a new company registering, or a company going
insolvent.

Companies House offers a streaming API, which sends events over a HTTPS connection.

## Technology

- server written in [TypeScript](https://www.typescriptlang.org/) with [Elysia](https://elysiajs.com) framework
  and [Bun](https://bun.sh)
  runtime run
  in [Docker](https://www.docker.com/) container deployed on [Digital Ocean](https://www.digitalocean.com/).
- [Redis Streams](https://redis.io/docs/data-types/streams/).
- [WebSockets](https://javascript.info/websocket) for client-server communication.
- Frontend client written in Typescript and built with [Vite](https://vitejs.dev/) (no frameworks, 10kb bundle).
- Served by [Caddy](https://caddyserver.com/)

## How it works

A [Docker compose](https://docs.docker.com/compose/) application with 3 main components for the backend:

1. A container to listen on the Companies House streaming API and publish events to Redis (
   see [streamToRedis.ts](server/src/redis/streamToRedis.ts)).
2. A Redis instance, mostly for facilitating Pub/Sub communication of events using Streams, and also for storing most
   recent timepoint
   to avoid missing any events.
3. A container which reads events from the Redis Stream and serves them as a WebSocket endpoint
   on `/events`, where each event is sent as a WebSocket message.

The frontend is "pure" in that it doesn't use a framework like React, which keeps the JS bundle really tiny and high
performance.
The animations are done in CSS using [SASS](https://sass-lang.com/).

To start up the whole application, clone the repository and run `docker compose up -d --build` in the root.
You will need an env file named `.api.env`containing streaming API key(s).
To run any files without Docker, install Bun (`bun install` in `/server` and `/client`).

## Make your own

If you are interested in using the companies house streaming API,
visit [developer-specs.company-information.service.gov.uk](https://developer-specs.company-information.service.gov.uk/streaming-api/guides/overview "Companies house developer website")
to create an account for a free API key. The API base url is https://stream.companieshouse.gov.uk
with paths `/companies`, `/filings`, `/officers`, `persons-with-significant-control`, `/charges`, `/insolvency-cases`
and `disqualified-officers`.

Here is a minimum working example in NodeJS using the [`split2`](https://www.npmjs.com/package/split2) package:

```typescript
import split2 from 'split2' // requires `npm i split2`
import { get } from "https"

const auth = process.env.STREAM_KEY + ":"
const path = "/filings"
const options = { hostname: "stream.companieshouse.gov.uk", path, auth }
get(options, (res) => {
  if (res.statusCode === 200)
    res.pipe(split2(JSON.parse)).on("data", console.log)
  else res.pipe(process.stdout)
  res.on("end", () => console.log("Stream ended."))
}).end()
```

For a more complete working example of listening on a stream in Javascript,
see [server/src/streams/splitStream.ts](server/src/streams/splitStream.ts) and
then [server/src/redis/streamToRedis.ts](server/src/redis/streamToRedis.ts).

To test the streaming API from the command line with CURL, you can use the cmdline utility (after compiling):

```bash
curl --user APIKEY: -s https://stream.companieshouse.gov.uk/filings | bun src/streams/streamCmdLine.ts
```

# Questions?

If you have any questions or suggestions please open an issue on the repository, and I will get back to you.

## Using this code

You are welcome to use this open source code for your own projects.
See the [LICENSE](LICENSE) file for more information.
