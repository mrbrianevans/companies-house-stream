import { createClient, RedisClientType, RedisFunctions, RedisModules, RedisScripts } from "redis"
import { streamFromRedisLogger } from "./loggers"

export async function getRedisClient(clientName?: string): Promise<RedisClient> {
  const logger = streamFromRedisLogger.child({ clientName })
  const client = createClient<RedisModules, RedisFunctions, RedisScripts>({
    url: `redis://${process.env.PUBSUB_REDIS_IP}:6379`,
    password: process.env.PUBSUB_REDIS_PASS
  })
  client.on("error", err => logger.error({ err }, "Redis Client Error"))
  client.on("end", () => logger.info("Redis Client closed"))
  await client.connect()
  logger.info({ ready: client.isReady, open: client.isOpen }, "Redis client connected")
  return client
}

export type RedisClient = RedisClientType<RedisModules, RedisFunctions, RedisScripts>


const redisClient = await getRedisClient("shared")
export { redisClient }
