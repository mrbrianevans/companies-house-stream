import { createClient } from "redis"

export async function getRedisClient() {
  const client = createClient({ url: "redis://206.189.26.20:6379" })
  await client.connect()
  return client
}
