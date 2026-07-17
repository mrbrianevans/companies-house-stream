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

## Test streaming sessions

Temporary developer sessions that mirror the official Streaming API on `test.companies.stream`. All keys expire after 24 hours (`EXPIRE 86400`).

- `test:session:{uuid}` - **String**
  - Session existence marker; value is ISO `created_at`
- `test:session:{uuid}:active` - **Sorted Set**
  - Score: connection start timestamp (ms)
  - Member: short `connId`
  - Used for ~10 concurrent connection limit (evict oldest)
- `test:session:{uuid}:logs` - **List**
  - JSON log entries (connect / disconnect / terminate / evict)
- `test:sessions:active` - **Sorted Set** (global)
  - Score: session create timestamp (ms)
  - Member: session uuid
  - Global concurrent session limit (1000)
