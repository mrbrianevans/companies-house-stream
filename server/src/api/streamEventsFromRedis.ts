import { AbortError, commandOptions } from "redis";
import { getRedisClient } from "../utils/getRedisClient.js";
import { streamFromRedisLogger as logger } from "../utils/loggers.js";

export type StreamChunk =
  | { type: "event"; eventId: string; eventJson: string }
  | { type: "heartbeat" };

interface StreamEventsFromRedisProps {
  streamPath: string;
  /** Redis stream ID to start after (exclusive). Use "$" for live-only. */
  startAfterId?: string;
  signal?: AbortSignal;
  /** XREAD BLOCK timeout in ms; null reads yield heartbeats. Default 10s. */
  blockMs?: number;
}

/**
 * Read events from a Redis stream as an async generator.
 * Advances the last-seen ID so historical catch-up then live works correctly.
 * Emits heartbeat chunks when a BLOCK wait times out with no events.
 */
export async function* streamEventsFromRedis(
  props: StreamEventsFromRedisProps,
): AsyncGenerator<StreamChunk> {
  const { streamPath, signal, blockMs = 10_000 } = props;
  const key = "events:" + streamPath;
  let lastId = props.startAfterId ?? "$";
  const streamingClient = await getRedisClient("test-stream:" + streamPath);

  try {
    while (true) {
      if (signal?.aborted) break;

      try {
        const ac = new AbortController();
        const triggerAbort = () => ac.abort();
        signal?.addEventListener("abort", triggerAbort);

        const options = commandOptions({ signal: ac.signal });
        const result = await streamingClient.xRead(
          options,
          { key, id: lastId },
          { COUNT: 50, BLOCK: blockMs },
        );

        signal?.removeEventListener("abort", triggerAbort);

        if (signal?.aborted) break;

        if (!result || result.length === 0) {
          yield { type: "heartbeat" };
          continue;
        }

        const { messages } = result[0];
        for (const item of messages) {
          lastId = item.id;
          const eventJson = item.message.event;
          if (typeof eventJson === "string") {
            yield { type: "event", eventId: item.id, eventJson };
          }
        }
      } catch (e) {
        if (e instanceof AbortError || signal?.aborted) break;
        logger.error(e, "Error READing from Redis stream for test session");
        break;
      }
    }
  } finally {
    await streamingClient.quit().catch(() => {});
  }
}

/**
 * Map a Companies House timepoint query to a Redis stream ID to start after.
 * Official API includes events from the given timepoint; Redis XREAD is exclusive,
 * so we start after (timepoint - 1).
 */
export function timepointToStartAfterId(timepoint: number): string {
  if (timepoint <= 0) return "0-0";
  return `${timepoint - 1}-0`;
}

/**
 * Check whether a requested timepoint is older than the oldest retained event.
 * Returns true if the client should receive HTTP 416.
 */
export async function isTimepointOutOfRange(
  redis: { xRange: (key: string, start: string, end: string, opts?: { COUNT: number }) => Promise<{ id: string }[]> },
  streamPath: string,
  timepoint: number,
): Promise<boolean> {
  const key = "events:" + streamPath;
  const oldest = await redis.xRange(key, "-", "+", { COUNT: 1 });
  // Empty buffer: allow the connection (client waits for live events / heartbeats).
  if (oldest.length === 0) return false;
  const oldestTimepoint = parseInt(oldest[0].id.split("-")[0] ?? "0", 10);
  return timepoint < oldestTimepoint;
}
