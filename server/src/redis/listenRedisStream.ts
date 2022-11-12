import { getRedisClient } from "../database/getRedisClient.js"


export async function *listenRedisStream<EventType extends Record<string, string>>(streamKeys: string[]){
  const redis = await getRedisClient()
  while(true) {
    const event = await redis.xRead(streamKeys.map(s=>({key: s, id: '$'})), {COUNT: 1, BLOCK: 0})
    if (event) {
      const {name: stream, messages: items} = event[0]
      const {id: eventId, message: data} = items[0]
      yield { stream, eventId, data: data as EventType }
    }
  }
}
