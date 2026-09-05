import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { env } from "../config/env.js";
import type { WorkspaceRoot } from "../state/project-state.js";

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

// One filesystem MCP server per open workspace (a workspace can hold multiple
// repo roots) — this is the core of multi-project safety: each server process
// only ever knows about its workspace's roots, so a tool call can never touch
// anything outside them even if the agent hallucinated the wrong path.
const filesystemServers = new Map<string, ConnectedServer>();
const toolOwnerByWorkspace = new Map<string, Map<string, Client>>();

function requireEnv() {
  if (!env) throw new Error("Desktop app is misconfigured - check the .env file (GOOGLE_API_KEY, etc).");
  return env;
}

function encodeWorkspaceRoots(roots: WorkspaceRoot[]): string {
  return roots.map((r) => `${r.name}=${r.root}`).join("\n");
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

/**
 * Spawns (or reconnects) a filesystem MCP server scoped to a workspace's
 * roots. Call whenever a workspace is created or a root is added to it; the
 * process gets restarted so its WORKSPACE_ROOTS is never stale.
 */
export async function connectWorkspaceFilesystem(workspaceId: string, roots: WorkspaceRoot[]): Promise<void> {
  const cfg = requireEnv();

  const existing = filesystemServers.get(workspaceId);
  if (existing) {
    await existing.client.close();
    filesystemServers.delete(workspaceId);
  }

  const server = await connectServer(
    `filesystem-${workspaceId}`,
    cfg.MCP_FILESYSTEM_SERVER_COMMAND,
    cfg.MCP_FILESYSTEM_SERVER_ARGS.split(" ").filter(Boolean),
    { WORKSPACE_ROOTS: encodeWorkspaceRoots(roots) }
  );
  filesystemServers.set(workspaceId, server);
  await refreshToolOwnerMap(workspaceId);
}

/** Tears down a workspace's filesystem server when the workspace is closed. */
export async function disconnectWorkspaceFilesystem(workspaceId: string): Promise<void> {
  const server = filesystemServers.get(workspaceId);
  if (!server) return;
  await server.client.close();
  filesystemServers.delete(workspaceId);
  toolOwnerByWorkspace.delete(workspaceId);
}

async function refreshToolOwnerMap(workspaceId: string): Promise<void> {
  const map = new Map<string, Client>();

  const fsServer = filesystemServers.get(workspaceId);
  for (const server of [webSearchServer, fsServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    for (const t of tools) map.set(t.name, server.client);
  }
  toolOwnerByWorkspace.set(workspaceId, map);
}

export async function listMcpToolsForWorkspace(workspaceId: string): Promise<McpToolDescriptor[]> {
  const descriptors: McpToolDescriptor[] = [];
  const fsServer = filesystemServers.get(workspaceId);
  for (const server of [webSearchServer, fsServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    descriptors.push(...tools);
  }
  return descriptors;
}

export async function callMcpToolForWorkspace(
  workspaceId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const owners = toolOwnerByWorkspace.get(workspaceId);
  const client = owners?.get(name);
  if (!client) {
    throw new Error(
      `No connected MCP server exposes a tool named "${name}" for this workspace - is it open?`
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