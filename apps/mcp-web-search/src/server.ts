import "./config/env.js"; // validates env and exits early with a clear error if misconfigured
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchTools } from "./tools/search.tools.js";

const server = new McpServer({ name: "web-search-mcp", version: "0.1.0" });

registerSearchTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

// Stdout is reserved for MCP protocol messages - all our own logs go to stderr.
console.error("✅ [mcp-web-search] MCP server ready over stdio");