import { app, ipcMain, dialog, BrowserWindow, shell } from "electron";
import path, { join } from "node:path";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { promises } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
const envPath = app.isPackaged ? path.join(process.resourcesPath, ".env") : path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
config({ path: envPath });
const envSchema = z.object({
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required (free key at aistudio.google.com/apikey)"),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-lite"),
  // mcp-web-search is reused as-is from the web project - same server, no changes needed.
  // Optional: if not set, the coding agent simply won't have web search (filesystem tools still work).
  TAVILY_API_KEY: z.string().optional(),
  // How to spawn each MCP server. Paths are relative to this app's location in
  // dev (monorepo sibling packages); override these in a packaged build.
  MCP_FILESYSTEM_SERVER_COMMAND: z.string().default("npx"),
  MCP_FILESYSTEM_SERVER_ARGS: z.string().default("tsx ../mcp-filesystem/src/server.ts"),
  MCP_WEB_SEARCH_SERVER_COMMAND: z.string().default("npx"),
  MCP_WEB_SEARCH_SERVER_ARGS: z.string().default("tsx ../mcp-web-search/src/server.ts")
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ [desktop] invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
}
const env = parsed.success ? parsed.data : null;
let mainWindow = null;
function setMainWindow(win) {
  mainWindow = win;
}
function getMainWindow() {
  return mainWindow;
}
const workspaces = /* @__PURE__ */ new Map();
let activeWorkspaceId = null;
function displayName(root) {
  return path.basename(root) || root;
}
function workspaceKey(roots) {
  return roots.map((r) => r.root).sort().join("\n");
}
function uniqueRootName(base, existing) {
  const cleaned = (base || "repo").replace(/[^a-zA-Z0-9_-]/g, "-");
  let candidate = cleaned;
  let suffix = 2;
  while (existing.some((r) => r.name === candidate)) {
    candidate = `${cleaned}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
function findWorkspaceByRoot(root) {
  return [...workspaces.values()].find((w) => w.roots.some((r) => r.root === root));
}
function createWorkspace(rootPath) {
  const existing = findWorkspaceByRoot(rootPath);
  if (existing) {
    activeWorkspaceId = existing.id;
    return existing;
  }
  const workspace = {
    id: randomUUID(),
    key: workspaceKey([{ name: uniqueRootName(displayName(rootPath), []), root: rootPath }]),
    name: displayName(rootPath),
    roots: [{ name: uniqueRootName(displayName(rootPath), []), root: rootPath }]
  };
  workspaces.set(workspace.id, workspace);
  activeWorkspaceId = workspace.id;
  return workspace;
}
function addRootToWorkspace(workspaceId, rootPath) {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) throw new Error(`Unknown workspace id "${workspaceId}"`);
  if (workspace.roots.some((r) => r.root === rootPath)) {
    activeWorkspaceId = workspace.id;
    return workspace;
  }
  const other = findWorkspaceByRoot(rootPath);
  if (other && other.id !== workspaceId) {
    activeWorkspaceId = other.id;
    throw new Error(`"${rootPath}" is already part of workspace "${other.name}".`);
  }
  workspace.roots = [
    ...workspace.roots,
    { name: uniqueRootName(displayName(rootPath), workspace.roots), root: rootPath }
  ];
  workspace.key = workspaceKey(workspace.roots);
  activeWorkspaceId = workspace.id;
  return workspace;
}
function removeWorkspace(id) {
  workspaces.delete(id);
  if (activeWorkspaceId === id) {
    const remaining = [...workspaces.keys()];
    activeWorkspaceId = remaining.length ? remaining[remaining.length - 1] : null;
  }
}
function removeRootFromWorkspace(workspaceId, rootName) {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) throw new Error(`Unknown workspace id "${workspaceId}"`);
  if (workspace.roots.length <= 1) {
    throw new Error(`Cannot remove the last repo from "${workspace.name}" - close the workspace instead.`);
  }
  const remaining = workspace.roots.filter((r) => r.name !== rootName);
  if (remaining.length === workspace.roots.length) throw new Error(`No repo named "${rootName}" in this workspace.`);
  workspace.roots = remaining;
  workspace.key = workspaceKey(workspace.roots);
  return workspace;
}
function setActiveWorkspace(id) {
  if (!workspaces.has(id)) throw new Error(`Unknown workspace id "${id}"`);
  activeWorkspaceId = id;
}
function getWorkspace(id) {
  return workspaces.get(id);
}
function getActiveWorkspaceId() {
  return activeWorkspaceId;
}
function listWorkspaces() {
  return [...workspaces.values()];
}
function resolveUiSafePath(workspaceId, prefixedPath) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace "${workspaceId}" is not open`);
  }
  if (path.isAbsolute(prefixedPath)) {
    throw new Error(
      `Path "${prefixedPath}" is absolute - all paths must be prefixed with a workspace root name, e.g. "frontend/src/index.ts".`
    );
  }
  const separator = prefixedPath.indexOf("/");
  const rootName = separator <= 0 ? prefixedPath : prefixedPath.slice(0, separator);
  const rel = separator <= 0 ? "" : prefixedPath.slice(separator + 1);
  const root = workspace.roots.find((r) => r.name === rootName);
  if (!root) {
    const names = workspace.roots.map((r) => r.name).join(", ");
    throw new Error(
      `Unknown root "${rootName}" in workspace "${workspace.name}". Available roots: ${names}.`
    );
  }
  const resolved = path.resolve(root.root, rel || ".");
  const isInsideRoot = resolved === root.root || resolved.startsWith(root.root + path.sep);
  if (!isInsideRoot) {
    throw new Error(`Path "${prefixedPath}" resolves outside root "${root.name}".`);
  }
  return resolved;
}
const IGNORE_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);
function registerFsIpc() {
  ipcMain.handle(
    "fs:read-directory",
    async (_event, workspaceId, prefixedPath) => {
      if (prefixedPath === ".") {
        const workspace = getWorkspace(workspaceId);
        if (!workspace) return [];
        return workspace.roots.map((r) => ({ name: r.name, type: "directory" }));
      }
      const target = resolveUiSafePath(workspaceId, prefixedPath);
      const entries = await promises.readdir(target, { withFileTypes: true });
      return entries.filter((e) => !IGNORE_DIRS.has(e.name)).map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" })).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
    }
  );
  ipcMain.handle("fs:read-file", async (_event, workspaceId, prefixedPath) => {
    const target = resolveUiSafePath(workspaceId, prefixedPath);
    return promises.readFile(target, "utf-8");
  });
  ipcMain.handle(
    "fs:save-file",
    async (_event, workspaceId, prefixedPath, content) => {
      const target = resolveUiSafePath(workspaceId, prefixedPath);
      await promises.writeFile(target, content, "utf-8");
    }
  );
}
let webSearchServer = null;
const filesystemServers = /* @__PURE__ */ new Map();
const toolOwnerByWorkspace = /* @__PURE__ */ new Map();
function requireEnv() {
  if (!env) throw new Error("Desktop app is misconfigured - check the .env file (GOOGLE_API_KEY, etc).");
  return env;
}
function encodeWorkspaceRoots(roots) {
  return roots.map((r) => `${r.name}=${r.root}`).join("\n");
}
async function connectServer(id, command, args, extraEnv) {
  const client = new Client({ name: `personal-assistant-desktop-${id}`, version: "0.1.0" });
  const transport = new StdioClientTransport({
    command,
    args,
    env: { ...getDefaultEnvironment(), ...extraEnv }
  });
  await client.connect(transport);
  console.log(`✅ [desktop] connected to MCP server: ${id}`);
  return { id, client };
}
async function initStaticServers() {
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
async function connectWorkspaceFilesystem(workspaceId, roots) {
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
async function disconnectWorkspaceFilesystem(workspaceId) {
  const server = filesystemServers.get(workspaceId);
  if (!server) return;
  await server.client.close();
  filesystemServers.delete(workspaceId);
  toolOwnerByWorkspace.delete(workspaceId);
}
async function refreshToolOwnerMap(workspaceId) {
  const map = /* @__PURE__ */ new Map();
  const fsServer = filesystemServers.get(workspaceId);
  for (const server of [webSearchServer, fsServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    for (const t of tools) map.set(t.name, server.client);
  }
  toolOwnerByWorkspace.set(workspaceId, map);
}
async function listMcpToolsForWorkspace(workspaceId) {
  const descriptors = [];
  const fsServer = filesystemServers.get(workspaceId);
  for (const server of [webSearchServer, fsServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    descriptors.push(...tools);
  }
  return descriptors;
}
async function callMcpToolForWorkspace(workspaceId, name, args) {
  const owners = toolOwnerByWorkspace.get(workspaceId);
  const client = owners?.get(name);
  if (!client) {
    throw new Error(
      `No connected MCP server exposes a tool named "${name}" for this workspace - is it open?`
    );
  }
  const result = await client.callTool({ name, arguments: args });
  const content = result.content ?? [];
  const text = content.filter((c) => c.type === "text" && typeof c.text === "string").map((c) => c.text).join("\n");
  if (result.isError) {
    throw new Error(text || `MCP tool "${name}" failed with no error message`);
  }
  return text;
}
function createChatModel() {
  if (!env) throw new Error("Desktop app is misconfigured - check the .env file");
  return new ChatGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
    model: env.GEMINI_MODEL,
    temperature: 0.2
    // lower than the web assistant's default - code correctness benefits from less variance
  });
}
function stringSchema(prop) {
  if (prop.enum && prop.enum.length > 0) {
    return z.enum(prop.enum);
  }
  let schema = z.string();
  if (prop.format === "email") schema = schema.email();
  if (prop.format === "date-time") schema = schema.datetime();
  return schema;
}
function propertyToZod(prop) {
  let schema;
  switch (prop.type) {
    case "string":
      schema = stringSchema(prop);
      break;
    case "number":
    case "integer":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "array":
      schema = z.array(prop.items ? propertyToZod(prop.items) : z.unknown());
      break;
    case "object":
      schema = objectToZod(prop);
      break;
    default:
      schema = z.unknown();
  }
  return prop.description ? schema.describe(prop.description) : schema;
}
function objectToZod(schema) {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const shape = {};
  for (const [key, propSchema] of Object.entries(properties)) {
    const fieldSchema = propertyToZod(propSchema);
    shape[key] = required.has(key) ? fieldSchema : fieldSchema.optional();
  }
  return z.object(shape);
}
function mcpInputSchemaToZod(inputSchema) {
  return objectToZod(inputSchema);
}
const pendingResolvers = /* @__PURE__ */ new Map();
function requestApproval(change) {
  const id = randomUUID();
  return new Promise((resolve) => {
    pendingResolvers.set(id, { workspaceId: change.workspaceId, resolve });
    getMainWindow()?.webContents.send("agent:pending-change", { ...change, id });
  });
}
function resolvePendingChange(id, approved) {
  const resolver = pendingResolvers.get(id);
  if (!resolver) return;
  pendingResolvers.delete(id);
  resolver.resolve(approved);
}
function cancelPendingChangesForWorkspace(workspaceId) {
  for (const [id, resolver] of pendingResolvers) {
    if (resolver.workspaceId === workspaceId) {
      pendingResolvers.delete(id);
      resolver.resolve(false);
    }
  }
}
const FILE_MUTATING_TOOLS = /* @__PURE__ */ new Set(["write_file", "edit_file", "delete_file", "create_directory"]);
const SUMMARY_BY_TOOL = {
  write_file: (fileExists) => fileExists ? "Overwrite file" : "Create file",
  edit_file: () => "Edit file",
  delete_file: () => "Delete",
  create_directory: () => "Create directory"
};
async function readCurrentContent(workspaceId, relativePath) {
  try {
    return await promises.readFile(resolveUiSafePath(workspaceId, relativePath), "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}
function previewEdit(before, oldStr, newStr) {
  const occurrences = before.split(oldStr).length - 1;
  if (occurrences !== 1) return null;
  return before.replace(oldStr, newStr);
}
async function requestFileChangeApproval(workspaceId, toolName, input) {
  const path2 = typeof input.path === "string" ? input.path : "unknown";
  const before = await readCurrentContent(workspaceId, path2);
  let after = null;
  if (toolName === "write_file" && typeof input.content === "string") {
    after = input.content;
  } else if (toolName === "edit_file" && before !== null && typeof input.oldStr === "string" && typeof input.newStr === "string") {
    after = previewEdit(before, input.oldStr, input.newStr);
  }
  return requestApproval({
    workspaceId,
    tool: toolName,
    path: path2,
    before,
    after,
    summary: SUMMARY_BY_TOOL[toolName](before !== null)
  });
}
async function loadMcpToolsForWorkspace(workspaceId) {
  const mcpTools = await listMcpToolsForWorkspace(workspaceId);
  return mcpTools.map(
    (mcpTool) => tool(
      async (input) => {
        if (FILE_MUTATING_TOOLS.has(mcpTool.name)) {
          const approved = await requestFileChangeApproval(
            workspaceId,
            mcpTool.name,
            input ?? {}
          );
          if (!approved) {
            return `The user declined this ${mcpTool.name} action. Do not retry it without being asked again. Tell the user you were blocked and ask how they'd like to proceed.`;
          }
        }
        return callMcpToolForWorkspace(workspaceId, mcpTool.name, input ?? {});
      },
      {
        name: mcpTool.name,
        description: mcpTool.description ?? `${mcpTool.name} (MCP tool)`,
        schema: mcpInputSchemaToZod(mcpTool.inputSchema)
      }
    )
  );
}
function historyDir() {
  return path.join(app.getPath("userData"), "chat-sessions");
}
function historyFile(workspaceKey2) {
  const hash = createHash("sha256").update(workspaceKey2).digest("hex").slice(0, 16);
  return path.join(historyDir(), `${hash}.json`);
}
async function loadChatHistory(workspaceKey2) {
  try {
    const raw = await promises.readFile(historyFile(workspaceKey2), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
async function saveChatHistory(workspaceKey2, messages) {
  await promises.mkdir(historyDir(), { recursive: true });
  await promises.writeFile(historyFile(workspaceKey2), JSON.stringify(messages, null, 2), "utf-8");
}
async function clearChatHistory(workspaceKey2) {
  try {
    await promises.unlink(historyFile(workspaceKey2));
  } catch {
  }
}
const SYSTEM_PROMPT = [
  "You are a coding agent working inside a multi-root workspace. The workspace contains one or more",
  "repositories, each addressed by its root name.",
  "",
  "EVERY file path you pass to the filesystem tools MUST be prefixed with the workspace root name,",
  "e.g. 'frontend/src/App.tsx' or 'backend/src/api.ts'. Use list_directory with '.' to see the available",
  "roots first if you're unsure. search_files spans all roots and reports prefixed paths, so use it to find",
  "code across the whole workspace.",
  "",
  "You can freely read and edit files in ANY root of the workspace - they are all part of the same project",
  "and the user expects you to look across them (e.g. change a frontend component and the backend API it",
  "talks to in one turn). Only touch files inside the workspace roots.",
  "",
  // (behavioral rules unchanged from prior design)
  "When you need to edit a file, read it first to see its exact current content, then use edit_file for",
  "targeted changes (or write_file to create/overwrite). Explain what you changed and why."
].join("\n");
const agentsByWorkspace = /* @__PURE__ */ new Map();
function toBaseMessages(display) {
  return display.map((m) => m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content));
}
async function buildCodingAgentForWorkspace(spec) {
  const mcpTools = await loadMcpToolsForWorkspace(spec.workspaceId);
  const agent = createReactAgent({ llm: createChatModel(), tools: mcpTools, prompt: SYSTEM_PROMPT });
  const displayMessages = await loadChatHistory(spec.workspaceKey);
  agentsByWorkspace.set(spec.workspaceId, {
    agent,
    workspaceKey: spec.workspaceKey,
    workspaceName: spec.workspaceName,
    roots: spec.roots,
    conversationHistory: toBaseMessages(displayMessages),
    displayMessages
  });
}
function disposeCodingAgentForWorkspace(workspaceId) {
  agentsByWorkspace.delete(workspaceId);
}
function formatContext(state, context) {
  const lines = [];
  lines.push(`Workspace roots: ${state.roots.join(", ")}`);
  if (context?.activeFilePath) {
    lines.push(`Active file (what the user is currently looking at): ${context.activeFilePath}`);
  }
  if (context?.openFilePaths.length) {
    lines.push(`Other open files: ${context.openFilePaths.join(", ")}`);
  }
  return `[Editor context]
${lines.join("\n")}

`;
}
function extractToolCallTrace(messages) {
  const trace = [];
  for (const message of messages) {
    if (message instanceof AIMessage && message.tool_calls?.length) {
      for (const call of message.tool_calls) {
        const resultMessage = messages.find(
          (m) => m instanceof ToolMessage && m.tool_call_id === call.id
        );
        trace.push({
          tool: call.name,
          input: call.args,
          output: typeof resultMessage?.content === "string" ? resultMessage.content : void 0
        });
      }
    }
  }
  return trace;
}
async function runCodingAgentForWorkspace(workspaceId, message, context) {
  const state = agentsByWorkspace.get(workspaceId);
  if (!state) {
    throw new Error("This workspace's agent isn't ready yet - try reopening the workspace.");
  }
  const previousLength = state.conversationHistory.length;
  state.conversationHistory.push(new HumanMessage(formatContext(state, context) + message));
  const result = await state.agent.invoke({ messages: state.conversationHistory });
  state.conversationHistory = result.messages;
  const lastMessage = result.messages[result.messages.length - 1];
  const answer = typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content);
  const newMessages = result.messages.slice(previousLength);
  const toolCalls = extractToolCallTrace(newMessages);
  state.displayMessages.push({ role: "user", content: message });
  state.displayMessages.push({ role: "assistant", content: answer, toolCalls });
  await saveChatHistory(state.workspaceKey, state.displayMessages);
  return { answer, toolCalls };
}
function getDisplayHistory(workspaceId) {
  return agentsByWorkspace.get(workspaceId)?.displayMessages ?? [];
}
async function resetConversationForWorkspace(workspaceId) {
  const state = agentsByWorkspace.get(workspaceId);
  if (!state) return;
  state.conversationHistory = [];
  state.displayMessages = [];
  await clearChatHistory(state.workspaceKey);
}
const pending = /* @__PURE__ */ new Map();
function resolveToolConfirmation(requestId, approved) {
  const resolver = pending.get(requestId);
  if (!resolver) return;
  pending.delete(requestId);
  resolver.resolve(approved);
}
function cancelPendingConfirmationsForWorkspace(workspaceId) {
  for (const [requestId, resolver] of pending) {
    if (resolver.workspaceId === workspaceId) {
      pending.delete(requestId);
      resolver.resolve(false);
    }
  }
}
async function pickDirectory(prompt = "Select a folder") {
  const win = getMainWindow();
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    title: prompt,
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}
async function spinUpWorkspace(workspace) {
  await connectWorkspaceFilesystem(workspace.id, workspace.roots);
  await buildCodingAgentForWorkspace({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    workspaceName: workspace.name,
    roots: workspace.roots.map((r) => r.name)
  });
}
function registerProjectIpc() {
  ipcMain.handle("project:open-folder", async () => {
    const root = await pickDirectory("Select a folder to open as a new workspace");
    if (!root) return null;
    const workspace = createWorkspace(root);
    await spinUpWorkspace(workspace);
    return workspace;
  });
  ipcMain.handle("project:add-root", async (_event, workspaceId) => {
    const root = await pickDirectory("Select a repo folder to add to this workspace");
    if (!root) return { ...getWorkspaceSafe(workspaceId) };
    const workspace = addRootToWorkspace(workspaceId, root);
    await spinUpWorkspace(workspace);
    return workspace;
  });
  ipcMain.handle(
    "project:remove-root",
    async (_event, workspaceId, rootName) => {
      const workspace = getWorkspaceSafe(workspaceId);
      if (workspace.roots.length <= 1) {
        await closeWorkspace(workspaceId);
        return null;
      }
      const updated = removeRootFromWorkspace(workspaceId, rootName);
      await spinUpWorkspace(updated);
      return updated;
    }
  );
  ipcMain.handle("project:list", () => listWorkspaces());
  ipcMain.handle("project:get-active", () => getActiveWorkspaceId());
  ipcMain.handle("project:switch", (_event, workspaceId) => {
    setActiveWorkspace(workspaceId);
  });
  ipcMain.handle("project:close", async (_event, workspaceId) => {
    await closeWorkspace(workspaceId);
  });
  async function closeWorkspace(workspaceId) {
    cancelPendingConfirmationsForWorkspace(workspaceId);
    cancelPendingChangesForWorkspace(workspaceId);
    await disconnectWorkspaceFilesystem(workspaceId);
    disposeCodingAgentForWorkspace(workspaceId);
    removeWorkspace(workspaceId);
  }
  function getWorkspaceSafe(id) {
    const ws = listWorkspaces().find((w) => w.id === id);
    if (!ws) throw new Error("Workspace not found");
    return ws;
  }
}
function registerAgentIpc() {
  ipcMain.handle(
    "agent:send-message",
    async (_event, workspaceId, message, context) => {
      const result = await runCodingAgentForWorkspace(workspaceId, message, context);
      notifyOfFileChanges(workspaceId, result);
      return result;
    }
  );
  ipcMain.handle("agent:get-history", (_event, workspaceId) => getDisplayHistory(workspaceId));
  ipcMain.handle("agent:clear-history", async (_event, workspaceId) => {
    await resetConversationForWorkspace(workspaceId);
  });
}
function notifyOfFileChanges(workspaceId, result) {
  const win = getMainWindow();
  if (!win) return;
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return;
  const changedPaths = result.toolCalls.filter((c) => FILE_MUTATING_TOOLS.has(c.tool)).map((c) => c.input?.path).filter((p) => Boolean(p));
  if (changedPaths.length) {
    win.webContents.send("fs:external-change", workspaceId, changedPaths);
  }
}
function registerApprovalIpc() {
  ipcMain.on("agent:respond-to-pending-change", (_event, id, approved) => {
    resolvePendingChange(id, approved);
  });
}
function registerConfirmationIpc() {
  ipcMain.handle("agent:confirm-tool", (_event, requestId, approved) => {
    resolveToolConfirmation(requestId, approved);
  });
}
const dirname = import.meta.dirname;
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0f14",
    // matches the app's dark theme - avoids a white flash on load
    webPreferences: {
      // electron-vite now builds this as CommonJS with an explicit .cjs
      // extension (see electron.vite.config.ts) - Electron's sandboxed
      // preload loader doesn't support ESM import syntax, so this can't be
      // .mjs or plain .js (which would be ESM under this package's "type":
      // "module" setting).
      preload: join(dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.on("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(dirname, "../renderer/index.html"));
  }
  return win;
}
app.whenReady().then(async () => {
  registerFsIpc();
  registerApprovalIpc();
  registerProjectIpc();
  registerAgentIpc();
  registerConfirmationIpc();
  const win = createWindow();
  setMainWindow(win);
  if (env) {
    try {
      await initStaticServers();
    } catch (err) {
      console.error("Failed to connect static MCP servers (web search will be unavailable):", err);
    }
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow();
      setMainWindow(newWin);
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
