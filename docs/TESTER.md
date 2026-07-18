# Test Streaming Sessions

Goal: Test feature so developers can create temporary sessions that mirror the official Companies House Streaming API (paths, auth, NDJSON, timepoints, 416, concurrent limits, abrupt close) and force-terminate connections on demand. UI on main domain; streams on `test.companies.stream`. 24 h auto-expiry. Reuse existing Redis stream readers and event data.

### Redis keys (all with `EXPIRE 86400`)
- `test:session:{uuid}` — simple key (or HASH with `created_at`) proving the session exists.
- `test:session:{uuid}:active` — Sorted Set (score = connect timestamp, member = short connId). Used for concurrency limit (~10) and eviction of oldest.
- `test:session:{uuid}:logs` — LIST of JSON log entries (connect/disconnect/terminate + IP, headers, UA, connId etc.). Low volume expected.
- `test:sessions:active` global concurrent session limit - Use a single Sorted Set (score = create timestamp, member = uuid).

Manual delete endpoint removes all three keys and ZREM from test:sessions:active.

### Global concurrency limit to avoid abuse
Use a single Sorted Set test:sessions:active (score = create timestamp, member = uuid).
On session create:

1. ZREMRANGEBYSCORE to drop anything older than 24 h
2. ZCARD — reject if ≥ 1000 (limit)
3. ZADD the new uuid

### Elysia plugin (`server/src/api/routes/testSessions.ts`)
Register as a plugin. Branch on hostname where needed.

**Main domain endpoints (UI support)**
- `POST /test/sessions` — Generate UUIDv4 server-side, create Redis keys, return `{ key: uuid }`. Global concurrent-session limit check + add.
- `GET /test/sessions/:uuid` — Return session status + connection logs (limited to recent 100, for dashboard). Can use `test:session:{uuid}:active` to enrich with which connections are still active/alive, or determine from disconnect logs.
- `POST /test/sessions/:uuid/terminate` — Close any active connections.
- `DELETE /test/sessions/:uuid` — Immediate cleanup of session data.

**Test subdomain endpoints** (`test.companies.stream`)
- `GET /:streamPath` (e.g. `/filings`, `/companies`, …) — Same paths as official.
    - Extract Basic Auth key (= uuid). No password after `:`, base64 encoded.
    - 401 if missing/invalid session.
    - Enforce concurrent limit via Sorted Set (evict oldest if >9).
    - Generate short connId, store in request context + ZADD to active set, log connect.
    - Reuse existing Redis-stream reader logic for events (support `?timepoint=`, return 416 for out-of-range).
    - Stream NDJSON + occasional blank-line heartbeats.
    - On client close / terminate signal: ZREM, log disconnect, abort response.
- Match official status codes, `Content-Type: text/plain; charset=utf-8`, chunked transfer.

Core streaming logic should call into the same code path already used for historical/live event delivery.

### Frontend (`client-pure/`, plain HTML + TS)
- Single page `test.html`.
- **Create / Resume**: Button to create new session **or** paste existing UUID → switch to session view.
- **Session dashboard**:
    - Display API key (the UUID) + base URL `https://test.companies.stream` + stream path list.
    - Copy buttons.
    - Live-ish connection logs (poll `GET /test/sessions/:uuid` every few seconds).
    - Terminate button + Delete button.
- Minimal JS: fetch + simple DOM updates. No framework. Try put UI elements in html and use ts for actions, rather than constructing dom from typescript.

### Matching official behaviour
| Aspect              | How we match                                      |
|---------------------|---------------------------------------------------|
| Paths               | Identical (`/filings`, `/companies`, etc.)        |
| Auth                | Basic Auth with key (UUID)                        |
| Response format     | NDJSON lines + blank-line heartbeats              |
| Timepoint           | Same query param + 416 for too-old/invalid        |
| Headers             | `text/plain; charset=utf-8`, chunked, keep-alive  |
| Concurrent conns    | Cap ~10, drop oldest                              |
| Termination         | Abrupt socket close (mimics midnight cutoff)      |
| Data                | Live + historical from existing Redis streams     |
| Errors              | 401 / 416 / 429-style where relevant              |

### Caddy / deployment
- Add `test.companies.stream` site block that proxies to the same Elysia process (hostname check inside app).
- No new containers. Same process, same Redis.

### Design principles
- One small plugin + thin UI page.
- Reuse existing stream-reading code.
- No extra services, no complex state machines.
- Everything auto-expires; optional manual delete.

Keep the feature small while maximising fidelity for testing reconnection / cutoff logic.

## Fault injection & Auto-tester
This feature has not been implemented yet, but noted down as a candidate for future development.

### More fault injection options
Add the ability to store a config for each session and have various settings in the session dashboard to change the config.
Store config as a stringified JSON object at `test:session:{uuid}:config`.

Ideas for config options:
 - 5xx error rate (percentage of responses to randomly send 5xx to)
 - start x events ago. so that connection requests without a timepoint get guaranteed events in response, regardless of current stream traffic.
 - max concurrent connections before eviction (default to official value of 9, some users may want to reduce for easier testing, min 1, max 10)
 - auto-terminate connections after x seconds. x seconds after a new connection is made, terminate itself without further user action. only terminates one connection, not all at same time.
 - 401 and 403 error rate. companies house sometimes randomly send these even with valid credentials.

### Stress test
A torture test mode which the user can enable to run a suite of fault injections and measure the response from the client.

Inject all manner of errors and test how long it takes the client to reconnect.

Test begins.
Client connects to all stream paths concurrently. Check the auth headers.
Then it starts terminating them at random, and waiting for the reconnection request.
Send bad response codes on the reconnection requests and check they retry appropriately. Check they never request the same stream more than once at a time.
Check they pick up again from exactly the right timepoint of where the last response got up to. 
Send at least one 416 code and check that the client drops the timepoint param.

Tick off the production-readiness checklist as the client passes each test.

## Appendix

### Sample headers
These are the headers sent with a successful response on the official api endpoints.
```json
{"date":"Fri, 17 Jul 2026 12:15:39 GMT","content-type":"text/plain; charset=utf-8","transfer-encoding":"chunked","connection":"keep-alive","access-control-allow-credentials":"true","access-control-allow-headers":"origin, content-type, content-length, user-agent, host, accept, authorization","access-control-expose-headers":"Location, www-authenticate, cache-control, pragma, content-type, expires, last-modified","access-control-max-age":"3600"}
```