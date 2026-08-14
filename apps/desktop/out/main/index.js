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
const projects = /* @__PURE__ */ new Map();
let activeProjectId = null;
function addProject(root) {
  const existing = [...projects.values()].find((p) => p.root === root);
  if (existing) {
    activeProjectId = existing.id;
    return existing;
  }
  const project = { id: randomUUID(), root, name: path.basename(root) };
  projects.set(project.id, project);
  activeProjectId = project.id;
  return project;
}
function removeProject(id) {
  projects.delete(id);
  if (activeProjectId === id) {
    const remaining = [...projects.keys()];
    activeProjectId = remaining.length ? remaining[remaining.length - 1] : null;
  }
}
function setActiveProject(id) {
  if (!projects.has(id)) throw new Error(`Unknown project id "${id}"`);
  activeProjectId = id;
}
function getProject(id) {
  return projects.get(id);
}
function getActiveProjectId() {
  return activeProjectId;
}
function listProjects() {
  return [...projects.values()];
}
function resolveUiSafePath(projectId, relativePath) {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project "${projectId}" is not open`);
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Path "${relativePath}" is absolute - all paths must be relative to the project root.`);
  }
  const resolved = path.resolve(project.root, relativePath);
  const isInsideRoot = resolved === project.root || resolved.startsWith(project.root + path.sep);
  if (!isInsideRoot) {
    throw new Error(`Path "${relativePath}" resolves outside project "${project.name}".`);
  }
  return resolved;
}
const IGNORE_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);
function registerFsIpc() {
  ipcMain.handle(
    "fs:read-directory",
    async (_event, projectId, relativePath) => {
      const target = resolveUiSafePath(projectId, relativePath);
      const entries = await promises.readdir(target, { withFileTypes: true });
      return entries.filter((e) => !IGNORE_DIRS.has(e.name)).map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" })).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
    }
  );
  ipcMain.handle("fs:read-file", async (_event, projectId, relativePath) => {
    const target = resolveUiSafePath(projectId, relativePath);
    return promises.readFile(target, "utf-8");
  });
  ipcMain.handle(
    "fs:save-file",
    async (_event, projectId, relativePath, content) => {
      const target = resolveUiSafePath(projectId, relativePath);
      await promises.writeFile(target, content, "utf-8");
    }
  );
}
let webSearchServer = null;
const filesystemServers = /* @__PURE__ */ new Map();
const toolOwnerByProject = /* @__PURE__ */ new Map();
function requireEnv() {
  if (!env) throw new Error("Desktop app is misconfigured - check the .env file (GOOGLE_API_KEY, etc).");
  return env;
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
async function connectProjectFilesystem(projectId, root) {
  const cfg = requireEnv();
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
async function disconnectProjectFilesystem(projectId) {
  const server = filesystemServers.get(projectId);
  if (!server) return;
  await server.client.close();
  filesystemServers.delete(projectId);
  toolOwnerByProject.delete(projectId);
}
async function refreshToolOwnerMap(projectId) {
  const map = /* @__PURE__ */ new Map();
  const fsServer = filesystemServers.get(projectId);
  for (const server of [webSearchServer, fsServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    for (const t of tools) map.set(t.name, server.client);
  }
  toolOwnerByProject.set(projectId, map);
}
async function listMcpToolsForProject(projectId) {
  const descriptors = [];
  const fsServer = filesystemServers.get(projectId);
  for (const server of [webSearchServer, fsServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    descriptors.push(...tools);
  }
  return descriptors;
}
async function callMcpToolForProject(projectId, name, args) {
  const owners = toolOwnerByProject.get(projectId);
  const client = owners?.get(name);
  if (!client) {
    throw new Error(
      `No connected MCP server exposes a tool named "${name}" for this project - is it open?`
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
const pending = /* @__PURE__ */ new Map();
function requestToolConfirmation(projectId, tool2, input) {
  const win = getMainWindow();
  if (!win) return Promise.resolve(false);
  const requestId = randomUUID();
  return new Promise((resolve) => {
    pending.set(requestId, { projectId, resolve });
    win.webContents.send("agent:tool-confirmation-request", { requestId, projectId, tool: tool2, input });
  });
}
function resolveToolConfirmation(requestId, approved) {
  const resolver = pending.get(requestId);
  if (!resolver) return;
  pending.delete(requestId);
  resolver.resolve(approved);
}
function cancelPendingConfirmationsForProject(projectId) {
  for (const [requestId, resolver] of pending) {
    if (resolver.projectId === projectId) {
      pending.delete(requestId);
      resolver.resolve(false);
    }
  }
}
const FILE_MUTATING_TOOLS = /* @__PURE__ */ new Set(["write_file", "edit_file", "delete_file", "create_directory"]);
async function loadMcpToolsForProject(projectId) {
  const mcpTools = await listMcpToolsForProject(projectId);
  return mcpTools.map(
    (mcpTool) => tool(
      async (input) => {
        if (FILE_MUTATING_TOOLS.has(mcpTool.name)) {
          const approved = await requestToolConfirmation(projectId, mcpTool.name, input);
          if (!approved) {
            return `The user declined this ${mcpTool.name} action. Do not retry it without being asked again. Tell the user you were blocked and ask how they'd like to proceed.`;
          }
        }
        return callMcpToolForProject(projectId, mcpTool.name, input ?? {});
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
function historyFile(projectRoot) {
  const hash = createHash("sha256").update(projectRoot).digest("hex").slice(0, 16);
  return path.join(historyDir(), `${hash}.json`);
}
async function loadChatHistory(projectRoot) {
  try {
    const raw = await promises.readFile(historyFile(projectRoot), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
async function saveChatHistory(projectRoot, messages) {
  await promises.mkdir(historyDir(), { recursive: true });
  await promises.writeFile(historyFile(projectRoot), JSON.stringify(messages, null, 2), "utf-8");
}
async function clearChatHistory(projectRoot) {
  try {
    await promises.unlink(historyFile(projectRoot));
  } catch {
  }
}
const SYSTEM_PROMPT = [
  /* unchanged */
].join("\n");
const agentsByProject = /* @__PURE__ */ new Map();
function toBaseMessages(display) {
  return display.map((m) => m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content));
}
async function buildCodingAgentForProject(projectId, projectRoot) {
  const mcpTools = await loadMcpToolsForProject(projectId);
  const agent = createReactAgent({ llm: createChatModel(), tools: mcpTools, prompt: SYSTEM_PROMPT });
  const displayMessages = await loadChatHistory(projectRoot);
  agentsByProject.set(projectId, {
    agent,
    projectRoot,
    conversationHistory: toBaseMessages(displayMessages),
    displayMessages
  });
}
function disposeCodingAgentForProject(projectId) {
  agentsByProject.delete(projectId);
}
function formatContext(context) {
  if (!context) return "";
  const lines = [];
  if (context.activeFilePath) lines.push(`Active file (what the user is currently looking at): ${context.activeFilePath}`);
  if (context.openFilePaths.length) lines.push(`Other open files: ${context.openFilePaths.join(", ")}`);
  return lines.length ? `[Editor context]
${lines.join("\n")}

` : "";
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
async function runCodingAgentForProject(projectId, message, context) {
  const state = agentsByProject.get(projectId);
  if (!state) {
    throw new Error("This project's agent isn't ready yet - try reopening the folder.");
  }
  const previousLength = state.conversationHistory.length;
  state.conversationHistory.push(new HumanMessage(formatContext(context) + message));
  const result = await state.agent.invoke({ messages: state.conversationHistory });
  state.conversationHistory = result.messages;
  const lastMessage = result.messages[result.messages.length - 1];
  const answer = typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content);
  const newMessages = result.messages.slice(previousLength);
  const toolCalls = extractToolCallTrace(newMessages);
  state.displayMessages.push({ role: "user", content: message });
  state.displayMessages.push({ role: "assistant", content: answer, toolCalls });
  await saveChatHistory(state.projectRoot, state.displayMessages);
  return { answer, toolCalls };
}
function getDisplayHistory(projectId) {
  return agentsByProject.get(projectId)?.displayMessages ?? [];
}
async function resetConversationForProject(projectId) {
  const state = agentsByProject.get(projectId);
  if (!state) return;
  state.conversationHistory = [];
  state.displayMessages = [];
  await clearChatHistory(state.projectRoot);
}
function registerProjectIpc() {
  ipcMain.handle("project:open-folder", async () => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return openProject(result.filePaths[0]);
  });
  ipcMain.handle("project:list", () => listProjects());
  ipcMain.handle("project:get-active", () => getActiveProjectId());
  ipcMain.handle("project:switch", (_event, projectId) => {
    setActiveProject(projectId);
  });
  ipcMain.handle("project:close", async (_event, projectId) => {
    cancelPendingConfirmationsForProject(projectId);
    await disconnectProjectFilesystem(projectId);
    disposeCodingAgentForProject(projectId);
    removeProject(projectId);
  });
}
async function openProject(root) {
  const project = addProject(root);
  await connectProjectFilesystem(project.id, project.root);
  await buildCodingAgentForProject(project.id, project.root);
  return project;
}
function registerAgentIpc() {
  ipcMain.handle(
    "agent:send-message",
    async (_event, projectId, message, context) => {
      const result = await runCodingAgentForProject(projectId, message, context);
      notifyOfFileChanges(projectId, result);
      return result;
    }
  );
  ipcMain.handle("agent:get-history", (_event, projectId) => getDisplayHistory(projectId));
  ipcMain.handle("agent:clear-history", async (_event, projectId) => {
    await resetConversationForProject(projectId);
  });
}
function notifyOfFileChanges(projectId, result) {
  const win = getMainWindow();
  if (!win) return;
  const project = getProject(projectId);
  if (!project) return;
  const changedPaths = result.toolCalls.filter((c) => FILE_MUTATING_TOOLS.has(c.tool)).map((c) => c.input?.path).filter((p) => Boolean(p));
  if (changedPaths.length) {
    win.webContents.send("fs:external-change", projectId, changedPaths);
  }
}
const pendingResolvers = /* @__PURE__ */ new Map();
function resolvePendingChange(id, approved) {
  const resolve = pendingResolvers.get(id);
  if (!resolve) return;
  pendingResolvers.delete(id);
  resolve(approved);
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
