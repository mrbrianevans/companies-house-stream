import { createClient } from "redis"
import * as logger from "node-color-log"

export const getValue: (key: string) => Promise<string | null> = async (
  key
) => {
  // console.log(`Redis getValue('${key}')`)
  if (Number(process.env.REDIS_CACHING) !== 1) return null
  try {
    const client = createClient({ host: "redis-cache" })
    const value = await new Promise<string | null>((resolve) =>
      client.get(key, (e, r) => {
        if (e) {
          console.error("Error fetching Redis value", e)
          resolve(null)
        } else {
          // logger
          //   .color(r ? "green" : "red")
          //   .log(`Redis Cache ${r ? "HIT" : "MISS"} for ${key}`)
          resolve(r)
        }
      })
    )
    await new Promise((resolve) => client.quit(resolve))
    return value
  } catch (e) {
    console.error("Failed to get redis value:")
    console.error(e)
    return null
  }
}

export const setValue: (key: string, value: string) => Promise<void> = async (
  key,
  value
) => {
  console.log(`Redis setValue('${key}', '${value}')`)
  if (Number(process.env.REDIS_CACHING) !== 1) return
  try {
    const client = createClient({ host: "redis-cache" })
    await new Promise((resolve) =>
      client.set(key, value, (e, r) => {
        if (e) {
          console.error("Error setting Redis value", e)
          resolve(null)
        } else {
          resolve(r)
        }
      })
    )
    await new Promise((resolve) => client.quit(resolve))
  } catch (e) {
    console.error("Failed to set redis value:")
    console.error(e)
  }
}
