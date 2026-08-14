import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { env } from "../config/env.js";

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

interface ConnectedServer {
  id: string;
  client: Client;
}

let webSearchServer: ConnectedServer | null = null;

// One filesystem MCP server per open project, keyed by projectId — this is
// the core of multi-project isolation: each server process only ever knows
// about its own PROJECT_ROOT, so a tool call for project A can never touch
// project B's files even if the agent hallucinated the wrong path.
const filesystemServers = new Map<string, ConnectedServer>();
const toolOwnerByProject = new Map<string, Map<string, Client>>();

function requireEnv() {
  if (!env) throw new Error("Desktop app is misconfigured - check the .env file (GOOGLE_API_KEY, etc).");
  return env;
}

async function connectServer(
  id: string,
  command: string,
  args: string[],
  extraEnv: Record<string, string>
): Promise<ConnectedServer> {
  const client = new Client({ name: `personal-assistant-desktop-${id}`, version: "0.1.0" });
  const transport = new StdioClientTransport({
    command,
    args,
    env: { ...getDefaultEnvironment(), ...extraEnv },
  });
  await client.connect(transport);
  console.log(`✅ [desktop] connected to MCP server: ${id}`);
  return { id, client };
}

/** Called once at app startup. Web search is optional - only connects if TAVILY_API_KEY is set. */
export async function initStaticServers(): Promise<void> {
  const cfg = requireEnv();
  if (cfg.TAVILY_API_KEY) {
    webSearchServer = await connectServer(
      "web-search",
      cfg.MCP_WEB_SEARCH_SERVER_COMMAND,
      cfg.MCP_WEB_SEARCH_SERVER_ARGS.split(" ").filter(Boolean),
      { TAVILY_API_KEY: cfg.TAVILY_API_KEY }
    );
  }
}

/** Spawns a new filesystem MCP server scoped to `root`, registered under `projectId`. */
export async function connectProjectFilesystem(projectId: string, root: string): Promise<void> {
  const cfg = requireEnv();

  // If this project is already connected (re-open case), don't leak a duplicate process.
  if (filesystemServers.has(projectId)) return;

  const server = await connectServer(
    `filesystem-${projectId}`,
    cfg.MCP_FILESYSTEM_SERVER_COMMAND,
    cfg.MCP_FILESYSTEM_SERVER_ARGS.split(" ").filter(Boolean),
    { PROJECT_ROOT: root }
  );
  filesystemServers.set(projectId, server);
  await refreshToolOwnerMap(projectId);
}

/** Tears down a project's filesystem server when the project is closed. */
export async function disconnectProjectFilesystem(projectId: string): Promise<void> {
  const server = filesystemServers.get(projectId);
  if (!server) return;
  await server.client.close();
  filesystemServers.delete(projectId);
  toolOwnerByProject.delete(projectId);
}

async function refreshToolOwnerMap(projectId: string): Promise<void> {
  const map = new Map<string, Client>();

  const fsServer = filesystemServers.get(projectId);
  for (const server of [webSearchServer, fsServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    for (const t of tools) map.set(t.name, server.client);
  }
  toolOwnerByProject.set(projectId, map);
}

export async function listMcpToolsForProject(projectId: string): Promise<McpToolDescriptor[]> {
  const descriptors: McpToolDescriptor[] = [];
  const fsServer = filesystemServers.get(projectId);
  for (const server of [webSearchServer, fsServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    descriptors.push(...tools);
  }
  return descriptors;
}

export async function callMcpToolForProject(
  projectId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const owners = toolOwnerByProject.get(projectId);
  const client = owners?.get(name);
  if (!client) {
    throw new Error(
      `No connected MCP server exposes a tool named "${name}" for this project - is it open?`
    );
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