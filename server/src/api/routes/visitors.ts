import { Elysia } from "elysia"
import { VisitorCounterService } from "../visitorCounter"
import { redisClient } from "../../utils/getRedisClient"

export const visitorsRouter = async (app: Elysia) => {
  const visitorCounter = new VisitorCounterService(redisClient)
  return app.get("/visitors", async () => {
    const total = await visitorCounter.getTotalCount()
    const today = await visitorCounter.getCount(new Date().toISOString().split("T")[0])
    return { total, today }
  })
    .get("/visitors/:date", async ({ params, set }) => {
      const { date } = params
      if (!/[0-9-]{10}/.test(date)) {
        set.status = (416)
        return ({ statusCode: 400, message: "Bad date format" })
      } else {
        if (new Date(date) < new Date("2023-09-12")) {
          set.status = (416)
          return ({
            statusCode: 416,
            message: "Records only began on 2023-09-12. Request a date after that"
          })
        } else {
          const count = await visitorCounter.getCount(date)
          return ({ [date]: count })
        }
      }
    })
}
