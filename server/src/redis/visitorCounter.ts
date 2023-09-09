import type { RedisClient } from "./getRedisClient"


/**
 * Keeps usage statistics without ever storing the clients IP address.
 * Uses a HyperLogLog in redis to count items WITHOUT storing them.
 * Preserves privacy and allows basic statistic reporting.
 */
export class VisitorCounterService {

  redisClient: RedisClient

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient
  }

  /**
   * Counts an IP address.
   */
  async count(ip: string) {
    const date = new Date().toISOString().slice(0, 10)
    await this.redisClient.pfAdd(`visitors-${date}`, ip)
    await this.redisClient.pfAdd(`visitors-total`, ip)
  }

  /**
   * Get the count for a specific day.
   * @param date - ISO date string of the day to retrieve.
   */
  async getCount(date?: string) {
    date ??= new Date().toISOString().slice(0, 10)
    return await this.redisClient.pfCount(`visitors-${date}`)
  }

  /**
   * Get the total number counted since records began (9 September 2023).
   */
  async getTotalCount() {
    return await this.redisClient.pfCount(`visitors-total`)
  }

}
