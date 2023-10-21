import { Elysia } from "elysia"
import { redisClient } from "../../utils/getRedisClient"

export const miscRouter = (app: Elysia) => {
  /** Returns an array of random company numbers */
  return app.get("/randomCompanyNumbers", async () => {
    const qty = 1 // this could be a search query param
    const companyNumbers = await redisClient.sRandMemberCount("companyNumbers", qty)
    return companyNumbers
  })
    .get("/schemas", async () => {
      const schemasRaw = await redisClient.hGetAll("schemas")
      const schemas = Object.fromEntries(Object.entries(schemasRaw).map(([schemaName, schemaString]) => [schemaName, JSON.parse(schemaString)]))
      return schemas
    })
}
