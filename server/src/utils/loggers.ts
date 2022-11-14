import pino from "pino"


export const streamFromRedisLogger = pino({ base: { process: 'streamFromRedis' } })
