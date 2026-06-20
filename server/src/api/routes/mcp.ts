import { Elysia } from "elysia"
import { redisClient } from "../../utils/getRedisClient"
import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server"
import { z } from "zod"

const server = new McpServer({
  name: 'companies.stream mcp',
  version: '1.0.0',
});

const transport = new WebStandardStreamableHTTPServerTransport();

server.registerTool(
  'random_company_numbers',
  {
    title: 'Random Company Numbers',
    description: 'Returns random UK company numbers',
    inputSchema: z.object({
      count: z
        .number()
        .int()
        .min(1)
        .max(100)
        .describe('How many company numbers to return (1-100)'),
    }),
  },
  async ({ count }) => {
    const companyNumbers = await redisClient.sRandMemberCount("companyNumbers", count)

    return {
      content: [{ type: 'text', text: JSON.stringify(companyNumbers, null, 2) }],
    };
  },
);

await server.connect(transport);

export const mcpRouter = (app: Elysia) => {
  return app.get('/mcp',({ request })=>transport.handleRequest(request))
}
