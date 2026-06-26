import { Elysia } from "elysia"
import { redisClient } from "../../utils/getRedisClient"
import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server"
import { z } from "zod"
import { streamPaths } from "../../streams/streamPaths"
import { VisitorCounterService } from "../visitorCounter"

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

server.registerTool(
  'get_resource_kind_json_schema',
  {
    title: 'Get Json Schema for a resource_kind',
    description: 'Returns the json schema for a Companies House entity. You can list resource_kinds before using this tool.',
    inputSchema: z.object({resource_kind: z.string().nonempty().describe("The resource kind of the entity")}),
  },
  async ({resource_kind}) => {
    console.log("MCP get schema for resource_kind", resource_kind)
    const schema = await redisClient.hGet("schemas", resource_kind)
    if(!schema) return {
      isError: true,
      content: [{ type: "text", text: "resource_kind not found. Try listing resource_kinds first." }]
    };
    return {
      content: [{ type: 'text', text: schema }],
    };
  },
);
server.registerTool(
  'list_all_resource_kinds',
  {
    title: 'List valid resource_kind values',
    description: 'Returns a list of valid resource_kinds. A stream can contain events of multiple resource kinds.',
    inputSchema: z.object({}),
  },
  async ({}) => {
    console.log("MCP get resource_kind list")
    const resourceKinds = await redisClient.hKeys("schemas")
    return {
      content: [{ type: 'text', text: JSON.stringify(resourceKinds) }],
    };
  },
);
server.registerTool(
  'list_stream_paths',
  {
    title: 'List valid stream paths',
    description: 'Returns a list of valid streams served by Companies House Streaming API.',
    inputSchema: z.object({}),
  },
  async ({}) => {
    console.log("MCP list stream paths")
    return {
      content: [{ type: 'text', text: JSON.stringify([...streamPaths]) }],
    };
  }
)
server.registerTool(
  'list_resource_kinds_frequencies_for_stream',
  {
    title: 'List resource_kind frequencies for a particular stream',
    description: 'Returns a list of resource_kinds that can appear on the stream along with the relative frequency of each one.',
    inputSchema: z.object({streamPath: z.string().nonempty().describe("Specify the stream to get resource_kind frequencies for.")}),
  },
  async ({streamPath}) => {
    console.log("MCP get resource_kind frequencies", streamPath)
    const frequencies = await redisClient.hGetAll(`resourceKinds:${streamPath}`)
    return {
      content: [{ type: 'text', text: JSON.stringify(frequencies, null, 2) }],
    };
  },
);
server.registerTool(
  'get_latest_sample_event',
  {
    title: 'Get the latest event for a stream',
    description: 'Returns the latest event published on a given stream. Since this is constantly changing, it serves as a random sample as well.',
    inputSchema: z.object({streamPath: z.string().nonempty().describe("Specify the stream to get the latest event for.")}),
  },
  async ({streamPath}) => {
    console.log("MCP get latest event", streamPath)
    if (streamPaths.has(streamPath)) {
      const history = await redisClient.xRevRange("events:" + streamPath, "+", "-", { COUNT: 1 })
      const [event] = history.map(h => JSON.parse(h.message.event))
      return {
        content: [{ type: 'text', text: JSON.stringify(event, null, 2) }],
      };
    }else{
      return {
        isError: true,
        content: [{ type: "text", text: "Invalid stream path. Try listing stream paths first." }]
      };
    }
  },
);
server.registerTool(
  'get_stream_daily_event_count',
  {
    title: 'Get the daily event count for a stream',
    description: 'Returns the daily event count for a given stream in the format { [date]: count } eg { "2022-01-01": 100, "2022-01-02": 105 }.',
    inputSchema: z.object({streamPath: z.string().nonempty().describe("Specify the stream to get the daily event count for. Must be a valid stream path. You can list stream paths first if you don't have an exact stream path.")}),
  },
  async ({streamPath}) => {
    console.log("MCP get event counts", streamPath)
    if (streamPaths.has(streamPath)) {
      const rawCounts = await redisClient.hGetAll(`counts:${streamPath}:daily`)
      const counts = Object.fromEntries(Object.entries(rawCounts).map(([date, count]) => [date, parseInt(count)]))
      return {
        content: [{ type: 'text', text: JSON.stringify(counts, null, 2) }],
      };
    }else{
      return {
        isError: true,
        content: [{ type: "text", text: "Invalid stream path. Try listing stream paths first." }]
      };
    }
  },
);
const visitorCounter = new VisitorCounterService(redisClient)

server.registerTool(
  'get_all_time_visitor_count',
  {
    title: 'Get all time visitor count for this site',
    description: 'Returns the total number of unique visitors who have connected to this site. De-duplicates by IP address, only counts websocket connections to exclude cold crawlers. Records began on 2023-09-12',
    inputSchema: z.object({}),
  },
  async ({}) => {
    console.log("MCP get visitor count")
    const count = await visitorCounter.getTotalCount()
    return {
      content: [{ type: 'text', text: JSON.stringify(count) }],
    };
  },
);
server.registerTool(
  'get_visitor_count_for_date',
  {
    title: 'Get visitor count for this site on a particular date',
    description: 'Returns the total number of unique visitors who have connected to this site on a particular date. De-duplicates by IP address, only counts websocket connections to exclude cold crawlers. Records began on 2023-09-12',
    inputSchema: z.object({date: z.string().nonempty().min(10).max(10).describe("Specify the date to get visitor count for in YYYY-MM-DD format.")}),
  },
  async ({date}) => {
    console.log("MCP get visitor count for date", date)
    if (new Date(date) < new Date("2023-09-12")) {
      return {
        isError: true,
        content: [{ type: "text", text: "Invalid date. Records only began on 2023-09-12. Request a date after that" }]
      };
    } else {
      const count = await visitorCounter.getCount(date)
      return {
        content: [{ type: 'text', text: JSON.stringify({ [date]: count }) }],
      };
    }
  },
);

await server.connect(transport);

export const mcpRouter = (app: Elysia) => {
  return app
    .get('/mcp', async ({ request, })=> transport.handleRequest(request))
    .post('/mcp', async ({ request, })=> transport.handleRequest(request))
}
