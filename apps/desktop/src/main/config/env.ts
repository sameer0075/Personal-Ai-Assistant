import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";
import { app } from "electron";

// In dev, .env sits next to package.json. In a packaged app, ship it beside
// the executable (or better: prompt for these in a Settings screen - a
// natural v2 once this is running end-to-end). Loading by absolute path here
// mirrors every other .env-per-process in this project.
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, ".env")
  : path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
loadDotenv({ path: envPath });

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
  MCP_WEB_SEARCH_SERVER_ARGS: z.string().default("tsx ../mcp-web-search/src/server.ts"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ [desktop] invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  // Don't hard-exit here the way the server processes do - show it in the UI
  // instead once the window exists, so the user isn't left staring at nothing.
}

export const env = parsed.success ? parsed.data : null;