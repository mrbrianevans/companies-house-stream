const MCP_URL = "/events/mcp";

type McpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
  };
};

async function listTools(): Promise<McpTool[]> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });

  const text = await res.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) throw new Error("No data in MCP response");

  const message = JSON.parse(dataLine.slice(6)) as {
    error?: { message: string };
    result?: { tools: McpTool[] };
  };
  if (message.error) throw new Error(message.error.message);
  return message.result?.tools ?? [];
}

function renderTools(tools: McpTool[], container: HTMLElement) {
  const list = document.createElement("ul");

  for (const tool of tools) {
    const item = document.createElement("li");

    const heading = document.createElement("h3");
    heading.textContent = tool.title ?? tool.name;
    item.appendChild(heading);

    const name = document.createElement("p");
    name.innerHTML = `<code>${tool.name}</code>`;
    item.appendChild(name);

    if (tool.description) {
      const description = document.createElement("p");
      description.textContent = tool.description;
      item.appendChild(description);
    }

    const properties = tool.inputSchema?.properties;
    if (properties && Object.keys(properties).length > 0) {
      const params = document.createElement("ul");
      for (const [paramName, param] of Object.entries(properties)) {
        const paramItem = document.createElement("li");
        const required = tool.inputSchema?.required?.includes(paramName) ? " (required)" : "";
        paramItem.textContent = `${paramName}${required}: ${param.description ?? param.type ?? ""}`;
        params.appendChild(paramItem);
      }
      item.appendChild(params);
    }

    list.appendChild(item);
  }

  container.replaceChildren(list);
}

const container = document.getElementById("mcp-tools");
if (container) {
  try {
    const tools = await listTools();
    renderTools(tools, container);
  } catch (err) {
    container.textContent = `Failed to load tools: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export {};
