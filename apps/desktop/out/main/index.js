import { app, ipcMain, dialog, BrowserWindow, shell } from "electron";
import path, { join } from "node:path";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { promises } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { randomUUID } from "node:crypto";
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
let currentProjectRoot = null;
function getProjectRoot() {
  return currentProjectRoot;
}
function setProjectRootState(root) {
  currentProjectRoot = root;
}
function resolveUiSafePath(relativePath) {
  const root = getProjectRoot();
  if (!root) {
    throw new Error("No project is open");
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Path "${relativePath}" is absolute - all paths must be relative to the project root.`);
  }
  const resolved = path.resolve(root, relativePath);
  const isInsideRoot = resolved === root || resolved.startsWith(root + path.sep);
  if (!isInsideRoot) {
    throw new Error(`Path "${relativePath}" resolves outside the open project.`);
  }
  return resolved;
}
const IGNORE_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", ".next", "out", "coverage", ".turbo", ".cache"]);
function registerFsIpc() {
  ipcMain.handle("fs:read-directory", async (_event, relativePath) => {
    const target = resolveUiSafePath(relativePath);
    const entries = await promises.readdir(target, { withFileTypes: true });
    return entries.filter((e) => !IGNORE_DIRS.has(e.name)).map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" })).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
  });
  ipcMain.handle("fs:read-file", async (_event, relativePath) => {
    const target = resolveUiSafePath(relativePath);
    return promises.readFile(target, "utf-8");
  });
  ipcMain.handle("fs:save-file", async (_event, relativePath, content) => {
    const target = resolveUiSafePath(relativePath);
    await promises.writeFile(target, content, "utf-8");
  });
}
let webSearchServer = null;
let filesystemServer = null;
let toolOwner = /* @__PURE__ */ new Map();
function requireEnv() {
  if (!env) throw new Error("Desktop app is misconfigured - check the .env file (GOOGLE_API_KEY missing?)");
  return env;
}
async function connectServer(id, command, args, extraEnv = {}) {
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
  await refreshToolOwnerMap();
}
async function setProjectRoot(projectRoot) {
  const cfg = requireEnv();
  if (filesystemServer) {
    await filesystemServer.client.close();
    filesystemServer = null;
  }
  filesystemServer = await connectServer(
    "filesystem",
    cfg.MCP_FILESYSTEM_SERVER_COMMAND,
    cfg.MCP_FILESYSTEM_SERVER_ARGS.split(" ").filter(Boolean),
    { PROJECT_ROOT: projectRoot }
  );
  await refreshToolOwnerMap();
}
async function refreshToolOwnerMap() {
  const map = /* @__PURE__ */ new Map();
  for (const server of [webSearchServer, filesystemServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    for (const t of tools) map.set(t.name, server.client);
  }
  toolOwner = map;
}
async function listMcpTools() {
  const descriptors = [];
  for (const server of [webSearchServer, filesystemServer]) {
    if (!server) continue;
    const { tools } = await server.client.listTools();
    descriptors.push(...tools);
  }
  return descriptors;
}
async function callMcpTool(name, args) {
  const client = toolOwner.get(name);
  if (!client) {
    throw new Error(
      filesystemServer ? `No connected MCP server exposes a tool named "${name}"` : `No connected MCP server exposes a tool named "${name}" - is a project open yet?`
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
    pendingResolvers.set(id, resolve);
    getMainWindow()?.webContents.send("agent:pending-change", { ...change, id });
  });
}
function resolvePendingChange(id, approved) {
  const resolve = pendingResolvers.get(id);
  if (!resolve) return;
  pendingResolvers.delete(id);
  resolve(approved);
}
const FILE_MUTATING_TOOLS$1 = /* @__PURE__ */ new Set(["write_file", "edit_file", "delete_file", "create_directory"]);
async function readCurrentContent(relativePath) {
  try {
    return await promises.readFile(resolveUiSafePath(relativePath), "utf-8");
  } catch {
    return null;
  }
}
function computeProposedChange(toolName, args, before) {
  switch (toolName) {
    case "write_file":
      return { after: String(args.content ?? ""), summary: before === null ? "Create new file" : "Overwrite file" };
    case "edit_file": {
      const oldStr = String(args.oldStr ?? "");
      const newStr = String(args.newStr ?? "");
      const after = before !== null && before.includes(oldStr) ? before.replace(oldStr, newStr) : null;
      return { after, summary: "Edit file" };
    }
    case "delete_file":
      return { after: null, summary: "Delete file or directory" };
    case "create_directory":
      return { after: null, summary: "Create directory" };
  }
}
async function loadMcpToolsForAgent() {
  const mcpTools = await listMcpTools();
  return mcpTools.map(
    (mcpTool) => tool(
      async (input) => {
        const args = input ?? {};
        if (FILE_MUTATING_TOOLS$1.has(mcpTool.name)) {
          const toolName = mcpTool.name;
          const path2 = String(args.path ?? "");
          const before = toolName === "create_directory" ? null : await readCurrentContent(path2);
          const { after, summary } = computeProposedChange(toolName, args, before);
          const approved = await requestApproval({ tool: toolName, path: path2, before, after, summary });
          if (!approved) {
            return `The user rejected this change (${summary.toLowerCase()} on "${path2}"). Do not apply it or try an equivalent workaround - ask what they'd like instead, or move on to something else.`;
          }
        }
        return callMcpTool(mcpTool.name, args);
      },
      {
        name: mcpTool.name,
        description: mcpTool.description ?? `${mcpTool.name} (MCP tool)`,
        schema: mcpInputSchemaToZod(mcpTool.inputSchema)
      }
    )
  );
}
const SYSTEM_PROMPT = [
  "You are a coding assistant working directly inside the user's open project, similar to Cursor. You have real",
  "tools, scoped to this project only:",
  "- list_directory / read_file / search_files: explore the codebase.",
  "- write_file: create a new file or fully overwrite an existing one.",
  "- edit_file: make a precise, targeted change to part of a file (preferred over write_file for existing files -",
  "  it changes only what needs to change, not the whole file).",
  "- create_directory / delete_file: filesystem housekeeping.",
  "- web_search / web_fetch (if available): look up docs, error messages, or library usage you're unsure about",
  "  rather than guessing.",
  "",
  "You DO actually call write_file/edit_file/create_directory/delete_file when asked - don't just describe the",
  "change and stop. Note that these four tools now show the user a diff and wait for their approval before the",
  "write actually happens - so call the tool as soon as you know what to change, rather than describing it first",
  "and waiting for a separate go-ahead; the approval step IS the go-ahead. If the user rejects a change, the tool",
  "result will say so - don't retry the same change or a workaround, ask what they'd prefer instead.",
  "When you finish a task, briefly summarize what you changed and in which files.",
  "You DO actually modify files when asked - don't just describe the change and stop, make it, the same way you",
  "would if the user asked you to send an email or create a calendar event in the other parts of this project.",
  "When you finish a task, briefly summarize what you changed and in which files.",
  "",
  "Editor state: each message may start with an '[Editor state]' block listing which files are open in the",
  "editor and which one is active. When the user says 'this file', 'this', 'the file I have open', or refers to",
  "'it' without naming a path, they mean the active file listed there - read it (if you haven't already this",
  "turn) rather than guessing a different file or asking which one they mean. If no file is active, and the",
  "request clearly needs one, ask which file or use search_files/list_directory to find a likely candidate."
].join("\n");
let agent = null;
let conversationHistory = [];
async function rebuildCodingAgent() {
  const mcpTools = await loadMcpToolsForAgent();
  agent = createReactAgent({ llm: createChatModel(), tools: mcpTools, prompt: SYSTEM_PROMPT });
  conversationHistory = [];
}
function formatEditorContext(context) {
  if (!context || context.openFilePaths.length === 0 && !context.activeFilePath) {
    return "";
  }
  const lines = ["[Editor state]"];
  if (context.openFilePaths.length > 0) {
    lines.push(`Open tabs: ${context.openFilePaths.join(", ")}`);
  }
  lines.push(
    context.activeFilePath ? `Active file (what "this file" refers to by default): ${context.activeFilePath}` : "No file is currently active."
  );
  return lines.join("\n") + "\n\n";
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
async function runCodingAgent(message, editorContext) {
  if (!agent) {
    throw new Error("No project is open yet - open a folder first.");
  }
  const contextualizedMessage = formatEditorContext(editorContext) + message;
  const previousLength = conversationHistory.length;
  conversationHistory.push(new HumanMessage(contextualizedMessage));
  const result = await agent.invoke({ messages: conversationHistory });
  conversationHistory = result.messages;
  const lastMessage = result.messages[result.messages.length - 1];
  const answer = typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content);
  const newMessages = result.messages.slice(previousLength);
  return { answer, toolCalls: extractToolCallTrace(newMessages) };
}
function registerProjectIpc() {
  ipcMain.handle("project:open-folder", async () => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    const root = result.filePaths[0];
    await openProject(root);
    return root;
  });
  ipcMain.handle("project:get-root", () => getProjectRoot());
}
async function openProject(root) {
  setProjectRootState(root);
  await setProjectRoot(root);
  await rebuildCodingAgent();
}
const FILE_MUTATING_TOOLS = /* @__PURE__ */ new Set(["write_file", "edit_file", "delete_file", "create_directory"]);
function registerAgentIpc() {
  ipcMain.handle(
    "agent:send-message",
    async (_event, message, editorContext) => {
      const result = await runCodingAgent(message, editorContext);
      notifyOfFileChanges(result);
      return result;
    }
  );
}
function notifyOfFileChanges(result) {
  const changedPaths = result.toolCalls.filter((call) => FILE_MUTATING_TOOLS.has(call.tool)).map((call) => call.input?.path).filter((p) => Boolean(p));
  if (changedPaths.length === 0) return;
  getMainWindow()?.webContents.send("fs:external-change", changedPaths);
}
function registerApprovalIpc() {
  ipcMain.on("agent:respond-to-pending-change", (_event, id, approved) => {
    resolvePendingChange(id, approved);
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
