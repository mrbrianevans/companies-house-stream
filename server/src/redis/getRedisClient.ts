import { createClient } from "redis"

export async function getRedisClient() {
  const client = createClient({
    url: `redis://${process.env.PUBSUB_REDIS_IP}:6379`,
    password: process.env.PUBSUB_REDIS_PASS
  })
  await client.connect()
  return client
}
