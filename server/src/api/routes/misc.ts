import { Elysia, t } from "elysia"
import { redisClient } from "../../utils/getRedisClient"

export const miscRouter = (app: Elysia) => {
  /** Returns an array of random company numbers */
  return app.get("/randomCompanyNumbers", async ({ query }) => {
    const { qty } = query
    const companyNumbers = await redisClient.sRandMemberCount("companyNumbers", qty)
    return companyNumbers
  }, {
    query: t.Optional(t.Object({
      qty: t.Numeric({
        default: 1, minimum: 1, maximum: 1000, multipleOf: 1
      })
    }))
  })
    .get("/schemas", async () => {
      const schemasRaw = await redisClient.hGetAll("schemas")
      const schemas = Object.fromEntries(Object.entries(schemasRaw).map(([schemaName, schemaString]) => [schemaName, JSON.parse(schemaString)]))
      return schemas
    })
}
