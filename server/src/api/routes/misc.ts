import { Elysia, t } from "elysia"
import { redisClient } from "../../utils/getRedisClient"

export const miscRouter = (app: Elysia) => {
  /** Returns an array of random company numbers */
  return app.get("/randomCompanyNumbers", async ({ query }) => {
    const qty = query.qty ?? 1
    const companyNumbers = await redisClient.sRandMemberCount("companyNumbers", qty)
    return companyNumbers
  }, { query: t.Optional(t.Object({ qty: t.Number() })) })
    .get("/schemas", async () => {
      const schemasRaw = await redisClient.hGetAll("schemas")
      const schemas = Object.fromEntries(Object.entries(schemasRaw).map(([schemaName, schemaString]) => [schemaName, JSON.parse(schemaString)]))
      return schemas
    })
}
