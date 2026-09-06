import "./config/env.js"; // validates env and exits early with a clear error if misconfigured
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGithubTools } from "./tools/github.tools.js";

const server = new McpServer({ name: "github-mcp", version: "0.1.0" });

registerGithubTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

// Stdout is reserved for MCP protocol messages - all our own logs go to stderr.
console.error("✅ [mcp-github] MCP server ready over stdio");