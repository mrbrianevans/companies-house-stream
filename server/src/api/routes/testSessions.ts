import { Elysia, t } from "elysia";
import { redisClient } from "../../utils/getRedisClient";
import { streamPaths } from "../../streams/streamPaths";
import {
  isTimepointOutOfRange,
  streamEventsFromRedis,
  timepointToStartAfterId,
} from "../streamEventsFromRedis";

const SESSION_TTL_SECONDS = 86_400;
const MAX_GLOBAL_SESSIONS = 1000;
const MAX_SESSION_CONNECTIONS = 10;
const LOG_LIMIT = 100;

const KEYS = {
  session: (uuid: string) => `test:session:${uuid}`,
  active: (uuid: string) => `test:session:${uuid}:active`,
  logs: (uuid: string) => `test:session:${uuid}:logs`,
  globalActive: "test:sessions:active",
} as const;

type LogEntry = {
  type: "connect" | "disconnect" | "terminate" | "evict";
  connId: string;
  ts: string;
  ip?: string;
  userAgent?: string;
  streamPath?: string;
  reason?: string;
  headers?: Record<string, string>;
};

/** In-memory abort handles so terminate/evict can close sockets immediately. */
const sessionConnections = new Map<string, Map<string, AbortController>>();

function shortConnId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function isTestHostname(host: string | undefined): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0].toLowerCase();
  return hostname === "test.companies.stream" || hostname.startsWith("test.");
}

function parseBasicAuthKey(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    // Official style: key: (password empty). Accept key alone too.
    const key = decoded.split(":")[0]?.trim();
    return key || null;
  } catch {
    return null;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function refreshSessionTtl(uuid: string): Promise<void> {
  const multi = redisClient.multi();
  multi.expire(KEYS.session(uuid), SESSION_TTL_SECONDS);
  multi.expire(KEYS.active(uuid), SESSION_TTL_SECONDS);
  multi.expire(KEYS.logs(uuid), SESSION_TTL_SECONDS);
  await multi.exec();
}

async function appendLog(uuid: string, entry: LogEntry): Promise<void> {
  await redisClient.rPush(KEYS.logs(uuid), JSON.stringify(entry));
  await redisClient.lTrim(KEYS.logs(uuid), -500, -1);
  await redisClient.expire(KEYS.logs(uuid), SESSION_TTL_SECONDS);
}

function registerConnection(uuid: string, connId: string, ac: AbortController): void {
  let map = sessionConnections.get(uuid);
  if (!map) {
    map = new Map();
    sessionConnections.set(uuid, map);
  }
  map.set(connId, ac);
}

function unregisterConnection(uuid: string, connId: string): void {
  const map = sessionConnections.get(uuid);
  if (!map) return;
  map.delete(connId);
  if (map.size === 0) sessionConnections.delete(uuid);
}

function abortConnection(uuid: string, connId: string): void {
  const ac = sessionConnections.get(uuid)?.get(connId);
  if (ac && !ac.signal.aborted) ac.abort();
}

function abortAllSessionConnections(uuid: string): string[] {
  const map = sessionConnections.get(uuid);
  if (!map) return [];
  const ids = [...map.keys()];
  for (const [, ac] of map) {
    if (!ac.signal.aborted) ac.abort();
  }
  sessionConnections.delete(uuid);
  return ids;
}

async function sessionExists(uuid: string): Promise<boolean> {
  return (await redisClient.exists(KEYS.session(uuid))) === 1;
}

async function enforceConnectionLimit(uuid: string): Promise<void> {
  // Evict oldest until under the cap (we add first, then trim extras).
  while (true) {
    const count = await redisClient.zCard(KEYS.active(uuid));
    if (count <= MAX_SESSION_CONNECTIONS) break;
    const oldest = await redisClient.zPopMin(KEYS.active(uuid));
    if (!oldest) break;
    const evictedId = oldest.value;
    abortConnection(uuid, evictedId);
    unregisterConnection(uuid, evictedId);
    await appendLog(uuid, {
      type: "evict",
      connId: evictedId,
      ts: new Date().toISOString(),
      reason: "concurrent_limit",
    });
  }
}

function clientIp(headers: Record<string, string | undefined>): string | undefined {
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return headers["x-real-ip"];
}

function pickHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const interesting = [
    "user-agent",
    "accept",
    "accept-encoding",
    "x-forwarded-for",
    "x-real-ip",
    "connection",
  ];
  const out: Record<string, string> = {};
  for (const key of interesting) {
    const value = headers[key];
    if (value) out[key] = value;
  }
  return out;
}

export const testSessionsRouter = (app: Elysia) => {
  // --- Main domain: session management ---
  app
    .post("/test/sessions", async ({ set }) => {
      const now = Date.now();
      const cutoff = now - SESSION_TTL_SECONDS * 1000;

      await redisClient.zRemRangeByScore(KEYS.globalActive, 0, cutoff);
      const activeCount = await redisClient.zCard(KEYS.globalActive);
      if (activeCount >= MAX_GLOBAL_SESSIONS) {
        set.status = 429;
        return {
          statusCode: 429,
          message: `Too many active test sessions (limit ${MAX_GLOBAL_SESSIONS}). Try again later.`,
        };
      }

      const uuid = crypto.randomUUID();
      const createdAt = new Date(now).toISOString();

      await redisClient.set(KEYS.session(uuid), createdAt, { EX: SESSION_TTL_SECONDS });
      await redisClient.zAdd(KEYS.globalActive, { score: now, value: uuid });
      // Keep global set from growing forever; members also cleaned on create.
      await redisClient.expire(KEYS.globalActive, SESSION_TTL_SECONDS);

      return { key: uuid, created_at: createdAt, expires_in_seconds: SESSION_TTL_SECONDS };
    })

    .get(
      "/test/sessions/:uuid",
      async ({ params, set }) => {
        const { uuid } = params;
        if (!isUuid(uuid)) {
          set.status = 400;
          return { statusCode: 400, message: "Invalid session id" };
        }
        if (!(await sessionExists(uuid))) {
          set.status = 404;
          return { statusCode: 404, message: "Session not found or expired" };
        }

        await refreshSessionTtl(uuid);

        const createdAt = await redisClient.get(KEYS.session(uuid));
        const logRaw = await redisClient.lRange(KEYS.logs(uuid), -LOG_LIMIT, -1);
        const logs = logRaw.map((line) => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return { type: "disconnect", connId: "?", ts: "", reason: "bad_log" };
          }
        });
        const activeMembers = await redisClient.zRangeWithScores(KEYS.active(uuid), 0, -1);
        const active_connections = activeMembers.map((m) => ({
          connId: m.value,
          connected_at: new Date(m.score).toISOString(),
          alive: sessionConnections.get(uuid)?.has(m.value) ?? false,
        }));

        return {
          key: uuid,
          created_at: createdAt,
          active_connections,
          logs,
          stream_base_url: "https://test.companies.stream",
          stream_paths: [...streamPaths],
        };
      },
      { params: t.Object({ uuid: t.String() }) },
    )

    .post(
      "/test/sessions/:uuid/terminate",
      async ({ params, set }) => {
        const { uuid } = params;
        if (!isUuid(uuid)) {
          set.status = 400;
          return { statusCode: 400, message: "Invalid session id" };
        }
        if (!(await sessionExists(uuid))) {
          set.status = 404;
          return { statusCode: 404, message: "Session not found or expired" };
        }

        const aborted = abortAllSessionConnections(uuid);
        const remaining = await redisClient.zRange(KEYS.active(uuid), 0, -1);
        for (const connId of remaining) {
          if (!aborted.includes(connId)) aborted.push(connId);
        }
        await redisClient.del(KEYS.active(uuid));

        const ts = new Date().toISOString();
        for (const connId of aborted) {
          await appendLog(uuid, {
            type: "terminate",
            connId,
            ts,
            reason: "manual_terminate",
          });
        }
        await refreshSessionTtl(uuid);

        return { terminated: aborted.length, connIds: aborted };
      },
      { params: t.Object({ uuid: t.String() }) },
    )

    .delete(
      "/test/sessions/:uuid",
      async ({ params, set }) => {
        const { uuid } = params;
        if (!isUuid(uuid)) {
          set.status = 400;
          return { statusCode: 400, message: "Invalid session id" };
        }

        abortAllSessionConnections(uuid);
        await redisClient.del([KEYS.session(uuid), KEYS.active(uuid), KEYS.logs(uuid)]);
        await redisClient.zRem(KEYS.globalActive, uuid);

        return { deleted: true, key: uuid };
      },
      { params: t.Object({ uuid: t.String() }) },
    );

  // --- Test subdomain: official-shaped streaming endpoints ---
  for (const streamPath of streamPaths) {
    app.get(`/${streamPath}`, async ({ request, query, set, headers }) => {
      const host = headers["host"];
      // Prefer test host, but allow direct hits for local/dev if Authorization is present.
      if (!isTestHostname(host) && !headers["authorization"]) {
        set.status = 404;
        return { statusCode: 404, message: "Not found" };
      }

      const key = parseBasicAuthKey(headers["authorization"]);
      if (!key || !isUuid(key) || !(await sessionExists(key))) {
        set.status = 401;
        set.headers["WWW-Authenticate"] = 'Basic realm="test.companies.stream"';
        return "Invalid Authorization";
      }

      const uuid = key;
      const timepointRaw = query.timepoint;
      let startAfterId = "$";

      if (timepointRaw !== undefined && timepointRaw !== null && String(timepointRaw) !== "") {
        const timepoint = Number(timepointRaw);
        if (!Number.isFinite(timepoint) || !Number.isInteger(timepoint) || timepoint < 0) {
          set.status = 400;
          return "Invalid timepoint";
        }
        if (await isTimepointOutOfRange(redisClient, streamPath, timepoint)) {
          set.status = 416;
          return "Timepoint out of range";
        }
        startAfterId = timepointToStartAfterId(timepoint);
      }

      const connId = shortConnId();
      const ac = new AbortController();
      const connectedAt = Date.now();
      const ip = clientIp(headers as Record<string, string | undefined>);
      const userAgent = headers["user-agent"];

      registerConnection(uuid, connId, ac);
      await redisClient.zAdd(KEYS.active(uuid), { score: connectedAt, value: connId });
      await enforceConnectionLimit(uuid);
      // If we were immediately evicted (race), bail out.
      if (ac.signal.aborted || !(await redisClient.zScore(KEYS.active(uuid), connId))) {
        unregisterConnection(uuid, connId);
        set.status = 429;
        return "Too many concurrent connections";
      }

      await appendLog(uuid, {
        type: "connect",
        connId,
        ts: new Date(connectedAt).toISOString(),
        ip,
        userAgent,
        streamPath,
        headers: pickHeaders(headers as Record<string, string | undefined>),
      });
      await refreshSessionTtl(uuid);

      const encoder = new TextEncoder();
      const requestSignal = request.signal;

      const onClientAbort = () => {
        if (!ac.signal.aborted) ac.abort();
      };
      requestSignal.addEventListener("abort", onClientAbort);

      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          const enqueue = (text: string) => {
            try {
              controller.enqueue(encoder.encode(text));
            } catch {
              // controller already closed
            }
          };

          try {
            for await (const chunk of streamEventsFromRedis({
              streamPath,
              startAfterId,
              signal: ac.signal,
            })) {
              if (ac.signal.aborted) break;
              if (chunk.type === "heartbeat") {
                enqueue("\n");
              } else {
                enqueue(chunk.eventJson + "\n");
              }
            }
          } catch {
            // stream aborted or redis error
          } finally {
            requestSignal.removeEventListener("abort", onClientAbort);
            await redisClient.zRem(KEYS.active(uuid), connId).catch(() => {});
            unregisterConnection(uuid, connId);
            await appendLog(uuid, {
              type: "disconnect",
              connId,
              ts: new Date().toISOString(),
              ip,
              userAgent,
              streamPath,
              reason: ac.signal.aborted ? "aborted" : "stream_ended",
            }).catch(() => {});
            // Prefer error close on abort so clients treat it as an abrupt cutoff.
            try {
              if (ac.signal.aborted) controller.error(new Error("connection terminated"));
              else controller.close();
            } catch {
              // already closed / cancelled
            }
          }
        },
        cancel() {
          if (!ac.signal.aborted) ac.abort();
        },
      });

      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    });
  }

  return app;
};
