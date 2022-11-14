import { getRedisClient } from "./getRedisClient.js"
import { AbortError, commandOptions } from "redis"
import { streamFromRedisLogger as logger } from "../utils/loggers.js"


interface ListenRedisStreamProps {
  streamKeys: { stream: string, timepoint?: string }[],
  signal?: AbortSignal
}

/**
 * Listen for events on a Redis stream. Keys prefixed with "events". Optionally pick up from a specific time point.
 */
export async function* listenRedisStream<EventType extends Record<string, string>>(props: ListenRedisStreamProps) {
  const redis = await getRedisClient()
  while (true) {
    try {
      const options = commandOptions({ signal: props.signal })
      const streams = props.streamKeys.map(({ stream, timepoint }) => ({
        key: "events:" + stream,
        id: timepoint ?? "$"
      }))
      const readOptions = { COUNT: 1, BLOCK: 0 }
      const event = await redis.xRead(options, streams, readOptions)
      if (event) {
        const { name: stream, messages: items } = event[0]
        const { id: eventId, message: data } = items[0]
        yield { stream, eventId, data: data as EventType }
      }
    } catch (e) {
      if(!(e instanceof AbortError))
        logger.error(e, "Error READing from Redis Stream(s)")
      break
    }
  }
}
