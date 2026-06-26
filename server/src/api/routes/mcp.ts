import { Elysia } from "elysia"
import { redisClient } from "../../utils/getRedisClient"
import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server"
import { z } from "zod"
import { streamPaths } from "../../streams/streamPaths"

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

server.registerTool(
  'get_stream_health',
  {
    title: 'Get Stream Health',
    description: 'Returns the health of the streams. A boolean for each stream to represent whether it is online (true) or offline (false).',
    inputSchema: z.object({}),
  },
  async () => {
    const streamsHealth: Record<string, boolean> = {}
    for (const streamPath of streamPaths) {
      const lastHeartbeat = await redisClient.hGet("heartbeats", streamPath).then(t => new Date(parseInt(t || "0")))
      streamsHealth[streamPath] = Date.now() - lastHeartbeat.getTime() < 60_000 // more than 60 seconds indicates stream offline
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(streamsHealth, null, 2) }],
    };
  },
);

await server.connect(transport);

export const mcpRouter = (app: Elysia) => {
  return app
    .get('/mcp', async ({ request, })=> transport.handleRequest(request))
    .post('/mcp', async ({ request, })=> transport.handleRequest(request))
}
