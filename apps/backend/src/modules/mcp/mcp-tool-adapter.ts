import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { listMcpTools, callMcpTool } from "./mcp-client.service.js";
import { mcpInputSchemaToZod } from "./mcp-schema-to-zod.js";

/**
 * Converts every tool exposed by the MCP server into a LangChain tool.
 *
 * Each tool's JSON Schema (as returned by the MCP protocol) is converted to a
 * real Zod schema via `mcpInputSchemaToZod` - LangChain's Gemini tool-binding
 * path requires an actual Zod object, not JSON Schema, despite `tool()`'s
 * types suggesting otherwise (see mcp-schema-to-zod.ts for the full story).
 * Adding a new tool to the MCP server still requires no changes here - only
 * the schema *shape* needs to stay within what mcpInputSchemaToZod supports.
 */
export async function loadMcpToolsForAgent(): Promise<StructuredToolInterface[]> {
  const mcpTools = await listMcpTools();

  return mcpTools.map((mcpTool) =>
    tool(
      async (input: unknown) => {
        return callMcpTool(mcpTool.name, (input ?? {}) as Record<string, unknown>);
      },
      {
        name: mcpTool.name,
        description: mcpTool.description ?? `${mcpTool.name} (MCP tool)`,
        schema: mcpInputSchemaToZod(mcpTool.inputSchema),
      }
    )
  );
}