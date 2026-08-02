import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { env } from "../../config/env.js";

/**
 * The backend talks to Gmail/Calendar exclusively through the MCP server in
 * apps/mcp-gmail-calendar - it never calls googleapis directly. This keeps
 * "how to talk to Google" in exactly one place, callable identically by the
 * LangGraph agent (as bound tools) and by plain REST routes (as direct calls).
 *
 * Transport: stdio. The backend spawns the MCP server as a child process and
 * speaks MCP over its stdin/stdout - no network port, no auth handshake of
 * its own to manage locally.
 */
let clientPromise: Promise<Client> | null = null;

async function connect(): Promise<Client> {
  const client = new Client({ name: "personal-assistant-backend", version: "0.1.0" });

  const [command, ...args] = [env.MCP_SERVER_COMMAND, ...env.MCP_SERVER_ARGS.split(" ").filter(Boolean)];
  const transport = new StdioClientTransport({ command, args });

  await client.connect(transport);
  console.log("✅ connected to MCP server (gmail/calendar)");
  return client;
}

export async function getMcpClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connect().catch((err) => {
      clientPromise = null; // allow retry on next call instead of caching a rejected promise forever
      throw err;
    });
  }
  return clientPromise;
}

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export async function listMcpTools(): Promise<McpToolDescriptor[]> {
  const client = await getMcpClient();
  const { tools } = await client.listTools();
  return tools;
}

/** Calls an MCP tool and returns its text content, throwing if the tool reported an error. */
export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  const client = await getMcpClient();
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