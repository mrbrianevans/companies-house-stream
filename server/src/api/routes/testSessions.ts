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

/** Caddy/Elysia test stream address, e.g. `test.companies.stream` or `localhost:3001`. */
function rawTestSiteAddress(): string {
  return (process.env.TEST_SITE_ADDRESS || "test.companies.stream").trim();
}

/**
 * Normalise a site address env value to `host` or `host:port` (no scheme, no trailing slash).
 * `:8080` becomes `localhost:8080`.
 */
function normalizeSiteAddress(addr: string): string {
  let a = addr.trim().replace(/\/$/, "");
  a = a.replace(/^https?:\/\//i, "");
  if (a.startsWith(":")) a = "localhost" + a;
  return a.toLowerCase();
}

/** Public base URL for clients (curl examples, dashboard). */
export function getTestStreamBaseUrl(): string {
  const raw = rawTestSiteAddress();
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  const normalized = normalizeSiteAddress(raw);
  if (
    normalized.startsWith("localhost") ||
    normalized.startsWith("127.0.0.1") ||
    /^\d{1,3}(\.\d{1,3}){3}/.test(normalized)
  ) {
    return `http://${normalized}`;
  }
  return `https://${normalized}`;
}

function isTestHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const expected = normalizeSiteAddress(rawTestSiteAddress());
  const actual = hostHeader.toLowerCase().trim();
  if (actual === expected) return true;
  // Default ports: Host may omit or include :80 / :443
  if (actual === `${expected}:443` || actual === `${expected}:80`) return true;
  if (expected === `${actual}:443` || expected === `${actual}:80`) return true;
  return false;
}

function shortConnId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
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

/**
 * Pin key expiry to session creation + 24h (absolute). Never extends lifetime.
 * Session key itself is created with EX and is never EXPIRE'd again.
 */
async function expireAtSessionEnd(uuid: string, key: string): Promise<void> {
  const createdAt = await redisClient.get(KEYS.session(uuid));
  if (!createdAt) return;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return;
  const expiresAtUnix = Math.floor(createdMs / 1000) + SESSION_TTL_SECONDS;
  await redisClient.expireAt(key, expiresAtUnix);
}

async function appendLog(uuid: string, entry: LogEntry): Promise<void> {
  await redisClient.rPush(KEYS.logs(uuid), JSON.stringify(entry));
  await redisClient.lTrim(KEYS.logs(uuid), -500, -1);
  await expireAtSessionEnd(uuid, KEYS.logs(uuid));
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

/** Abort all live connections; each connection's cleanup removes itself from Redis active set. */
function abortAllSessionConnections(uuid: string): string[] {
  const map = sessionConnections.get(uuid);
  if (!map) return [];
  const ids = [...map.keys()];
  for (const [, ac] of map) {
    if (!ac.signal.aborted) ac.abort();
  }
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

      // Drop only expired session members; never EXPIRE/delete the global set key itself.
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

      // TTL is fixed at creation — never extended on later activity.
      await redisClient.set(KEYS.session(uuid), createdAt, { EX: SESSION_TTL_SECONDS });
      await redisClient.zAdd(KEYS.globalActive, { score: now, value: uuid });

      return {
        key: uuid,
        created_at: createdAt,
        expires_in_seconds: SESSION_TTL_SECONDS,
        stream_base_url: getTestStreamBaseUrl(),
      };
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
          stream_base_url: getTestStreamBaseUrl(),
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

        // Abort only; each stream's cleanup removes its own member from the active set.
        const aborted = abortAllSessionConnections(uuid);

        const ts = new Date().toISOString();
        for (const connId of aborted) {
          await appendLog(uuid, {
            type: "terminate",
            connId,
            ts,
            reason: "manual_terminate",
          });
        }

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
        // Remove only this session from the global set; leave the set key intact.
        await redisClient.zRem(KEYS.globalActive, uuid);

        return { deleted: true, key: uuid };
      },
      { params: t.Object({ uuid: t.String() }) },
    );

  // --- Test site: official-shaped streaming endpoints (Host = TEST_SITE_ADDRESS) ---
  for (const streamPath of streamPaths) {
    app.get(`/${streamPath}`, async ({ request, query, set, headers }) => {
      if (!isTestHost(headers["host"])) {
        set.status = 404;
        return { statusCode: 404, message: "Not found" };
      }

      const key = parseBasicAuthKey(headers["authorization"]);
      if (!key || !isUuid(key) || !(await sessionExists(key))) {
        set.status = 401;
        set.headers["WWW-Authenticate"] =
          `Basic realm="${normalizeSiteAddress(rawTestSiteAddress())}"`;
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
      await expireAtSessionEnd(uuid, KEYS.active(uuid));
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
