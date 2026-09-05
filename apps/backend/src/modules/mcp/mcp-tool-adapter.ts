import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { listMcpTools, callMcpTool } from "./mcp-client.service.js";
import { mcpInputSchemaToZod } from "./mcp-schema-to-zod.js";

// Tools the agent must NEVER call directly: anything that really sends/publishes
// something must go through the app's human-approval queue, and destructive
// actions like deleting a LinkedIn post are only reachable via user-initiated
// features (the profile panels), not from a model turn. Excluding them here
// means no agent of any kind gets them.
const AGENT_FORBIDDEN_TOOLS = new Set([
  "gmail_send_message",
  "gmail_send_bulk",
  "linkedin_create_post",
  "linkedin_delete_post",
  "whatsapp_send_message",
]);

/**
 * Loads every MCP tool (minus the forbidden ones above) as a LangChain
 * tool, keyed by tool name. Specialist agents pick the subset they own.
 */
export async function loadMcpToolsByName(): Promise<Record<string, StructuredToolInterface>> {
  const mcpTools = await listMcpTools();
  const out: Record<string, StructuredToolInterface> = {};

  for (const mcpTool of mcpTools) {
    if (AGENT_FORBIDDEN_TOOLS.has(mcpTool.name)) continue;
    out[mcpTool.name] = tool(
      async (input: unknown, config?: RunnableConfig) => {
        const userId = config?.configurable?.userId as string | undefined;
        const args = { ...((input as Record<string, unknown> | undefined) ?? {}), userId };
        return callMcpTool(mcpTool.name, args);
      },
      {
        name: mcpTool.name,
        description: mcpTool.description ?? `${mcpTool.name} (MCP tool)`,
        schema: mcpInputSchemaToZod(mcpTool.inputSchema),
      }
    );
  }

  return out;
}