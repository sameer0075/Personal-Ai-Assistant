import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { env } from "../../config/env.js";

/**
 * The backend talks to every external service (Gmail/Calendar, LinkedIn, and
 * whatever comes next - GitHub/Bitbucket, etc.) exclusively through MCP
 * servers - it never calls their SDKs/APIs directly. This registry is what
 * lets that scale past a single server: each entry is one MCP server process,
 * and tool calls are routed to whichever server actually exposes that tool.
 * Adding a new integration means adding one entry here, not touching the
 * agent, the routes, or anything else that calls `callMcpTool`.
 */
interface McpServerConfig {
  id: string;
  command: string;
  args: string[];
}

const MCP_SERVER_CONFIGS: McpServerConfig[] = [
  {
    id: "gmail-calendar",
    command: env.MCP_GMAIL_CALENDAR_SERVER_COMMAND,
    args: env.MCP_GMAIL_CALENDAR_SERVER_ARGS.split(" ").filter(Boolean),
  },
  {
    id: "linkedin",
    command: env.MCP_LINKEDIN_SERVER_COMMAND,
    args: env.MCP_LINKEDIN_SERVER_ARGS.split(" ").filter(Boolean),
  },
];

interface ConnectedServer {
  id: string;
  client: Client;
}

let connectPromise: Promise<ConnectedServer[]> | null = null;
// Populated lazily from listMcpTools() - maps a tool name to the server that owns it,
// so callMcpTool doesn't need to search every server on every call.
let toolOwner: Map<string, Client> | null = null;

async function connectAll(): Promise<ConnectedServer[]> {
  const servers = await Promise.all(
    MCP_SERVER_CONFIGS.map(async (cfg): Promise<ConnectedServer> => {
      const client = new Client({ name: `personal-assistant-backend-${cfg.id}`, version: "0.1.0" });
      const transport = new StdioClientTransport({ command: cfg.command, args: cfg.args });
      await client.connect(transport);
      console.log(`✅ connected to MCP server: ${cfg.id}`);
      return { id: cfg.id, client };
    })
  );
  return servers;
}

async function getConnectedServers(): Promise<ConnectedServer[]> {
  if (!connectPromise) {
    connectPromise = connectAll().catch((err) => {
      connectPromise = null; // allow retry on next call instead of caching a rejected promise forever
      throw err;
    });
  }
  return connectPromise;
}

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/** Lists every tool across every connected MCP server, and (re)builds the tool -> server routing map. */
export async function listMcpTools(): Promise<McpToolDescriptor[]> {
  const servers = await getConnectedServers();
  const ownerMap = new Map<string, Client>();
  const allTools: McpToolDescriptor[] = [];

  for (const server of servers) {
    const { tools } = await server.client.listTools();
    for (const t of tools) {
      ownerMap.set(t.name, server.client);
      allTools.push(t);
    }
  }

  toolOwner = ownerMap;
  return allTools;
}

/** Calls an MCP tool (on whichever server exposes it) and returns its text content, throwing on tool-reported errors. */
export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (!toolOwner) {
    await listMcpTools();
  }

  const client = toolOwner?.get(name);
  if (!client) {
    throw new Error(`No connected MCP server exposes a tool named "${name}"`);
  }

  const result = await client.callTool({ name, arguments: args });

  const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
  const text = content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");

  if (result.isError) {
    throw new Error(text || `MCP tool "${name}" failed with no error message`);
  }

  return text;
}