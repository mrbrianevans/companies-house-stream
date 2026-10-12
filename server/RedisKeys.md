# Redis Key Patterns

This document outlines the Redis key patterns used throughout the application.

## Stream Keys

- `events:{streamPath}` - **Stream**
  - Stores events from Companies House streams
  - Managed with `xAdd` and `xRead` commands

## Timepoint Keys

- `timepoints:{streamPath}` - **String**
  - Stores the most recent timepoint for each stream
  - Expires after 7 days

## Counter Keys

- `counts:{streamPath}:daily` - **Hash**
  - Keys: ISO date strings (YYYY-MM-DD)
  - Values: Daily event counts for each stream
- `resourceKinds:{streamPath}` - **Hash**
  - Keys: Resource kind values
  - Values: Count of events per resource kind

## Set Keys

- `companyNumbers` - **Set**
  - Contains company numbers extracted from events
  - Limited to 5,000 entries

## HyperLogLog Keys

- `visitors-{date}` - **HyperLogLog**
  - Counts unique visitors per day
- `visitors-total` - **HyperLogLog**
  - Counts all-time unique visitors

## Hash Keys

- `schemas` - **Hash**
  - Keys: Resource kind values
  - Values: JSON schemas as strings
- `heartbeats` - **Hash**
  - Keys: Stream paths
  - Values: Timestamp of last heartbeat

## Simple Keys

- `currentWsConnections` - **String**
  - Counter for current WebSocket connections
- `site:announcement` - **String**
  - HTML fragment shown in the banner on the home page
  - A missing, empty, or whitespace-only value hides the banner
  - Returned as the body of `GET /announcement` (public path `/events/announcement`)

## Test streaming sessions

Temporary developer sessions that mirror the official Streaming API on `TEST_SITE_ADDRESS` (default `test.companies.stream`). Session data expires **exactly 24 hours after creation** (TTL is never refreshed).

- `test:session:{uuid}` - **String**
  - Session existence marker; value is ISO `created_at`
  - `EX 86400` set once at creation only
- `test:session:{uuid}:active` - **Sorted Set**
  - Score: connection start timestamp (ms)
  - Member: short `connId`
  - Used for ~10 concurrent connection limit (evict oldest)
  - `EXPIREAT` aligned to session creation + 24h (not extended)
- `test:session:{uuid}:logs` - **List**
  - JSON log entries (connect / disconnect / terminate / evict)
  - `EXPIREAT` aligned to session creation + 24h (not extended)
- `test:sessions:active` - **Sorted Set** (global)
  - Score: session create timestamp (ms)
  - Member: session uuid
  - Global concurrent session limit (1000)
  - Key is **not** expired; expired members are removed with `ZREMRANGEBYSCORE` / `ZREM` only
