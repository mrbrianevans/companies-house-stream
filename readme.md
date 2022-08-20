# Companies Stream

This project is a visualiser of changes made to the Companies House database of UK companies. It
shows events as they happen in realtime, such as a new company registering, or a company going
insolvent.

Companies House offers a streaming API, which sends events over a HTTPS connection.

## Technology

- [NodeJS](https://nodejs.org) server with [express](https://www.npmjs.com/package/express) written
  in [TypeScript](https://www.typescriptlang.org/) run in [Docker](https://www.docker.com/).
- [Redis pub/sub](https://redis.com/redis-best-practices/communication-patterns/pub-sub/) database to transmit events.
- [WebSockets](https://javascript.info/websocket) for client-server communication.
- Frontend client using [Solid](https://www.solidjs.com/) and [Vite](https://vitejs.dev/).

## How it works

A [Docker compose](https://docs.docker.com/compose/) application with 3 main components for the backend:

1. A NodeJS container to listen on the Companies House streaming API and publish events to Redis (
   see [streamToRedis.ts](server/src/redis/streamToRedis.ts)).
2. A Redis instance, mostly for facilitating Pub/Sub communication of events, and also for storing most recent timepoint
   to avoid missing any events.
3. A NodeJS container which subscribes to events on the Redis instance and serves them as a WebSocket endpoint
   on `/events`, where each event is sent as a WebSocket message.

The frontend is Solid components written in TypeScript. The animations are done in CSS
using [SASS](https://sass-lang.com/).
It is built with Vite in a Docker container, and served with [Caddy](https://caddyserver.com/) (which is also a gateway
to the backend endpoints and WebSocket).

To start up the whole application, clone the repository and run `docker compose up -d --build` in the root.
You will need an env file named `.api.env`containing streaming API key(s).
To run any files without Docker, build the project by installing dependencies compiling
TypeScript (`pnpm i && pnpm build` in `/server` and `/client`).
[PNPM](https://pnpm.io/) is used as the package manager, but [NPM](https://docs.npmjs.com/cli/v8) will also work (but it
won't recognise the lock files).

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

For a more complete working example of listening on a stream in NodeJS,
see [server/src/streams/splitStream.ts](server/src/streams/splitStream.ts) and
then [server/src/redis/streamToRedis.ts](server/src/redis/streamToRedis.ts).

To test the streaming API from the command line with CURL, you can use the cmdline utility (after compiling):

```bash
curl --user APIKEY: -s https://stream.companieshouse.gov.uk/filings | node dist/streams/streamCmdLine.js
```

# Questions?

If you have any questions or suggestions please open an issue on the repository, and I will get back to you.

## Using this code

You are welcome to use this open source code for your own projects.
See the [LICENSE](LICENSE) file for more information.
