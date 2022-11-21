import { createClient, RedisClientType, RedisFunctions, RedisModules, RedisScripts } from "redis"

export async function getRedisClient(): Promise<RedisClient> {
  const client = createClient<RedisModules, RedisFunctions, RedisScripts>({
    url: `redis://${process.env.PUBSUB_REDIS_IP}:6379`,
    password: process.env.PUBSUB_REDIS_PASS
  })
  await client.connect()
  return client
}

export type RedisClient = RedisClientType<RedisModules, RedisFunctions, RedisScripts>
