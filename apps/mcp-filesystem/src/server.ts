import "./config/env.js"; // validates WORKSPACE_ROOTS and exits early if missing/invalid
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFilesystemTools } from "./tools/filesystem.tools.js";
import { env } from "./config/env.js";

const server = new McpServer({ name: "filesystem-mcp", version: "0.1.0" });

registerFilesystemTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

// Stdout is reserved for MCP protocol messages - all our own logs go to stderr.
console.error(
  `✅ [mcp-filesystem] MCP server ready over stdio, scoped to ${env.WORKSPACE_ROOTS.length} root(s): ${env.WORKSPACE_ROOTS.map(
    (r) => `${r.name}=${r.root}`
  ).join(", ")}`
);