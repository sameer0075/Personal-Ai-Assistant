import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { listMcpTools, callMcpTool } from "./mcp-client.service.js";
import { mcpInputSchemaToZod } from "./mcp-schema-to-zod.js";

// Tools that really send/publish something must only ever run through the
// app's human-approval queue (approved via the UI) - never directly by a model.
// They are excluded here, so no agent of any kind gets them.
const ACTIONS_REQUIRING_APPROVAL = new Set([
  "gmail_send_message",
  "gmail_send_bulk",
  "linkedin_create_post",
]);

/**
 * Loads every MCP tool (minus the approval-only ones above) as a LangChain
 * tool, keyed by tool name. Specialist agents pick the subset they own.
 */
export async function loadMcpToolsByName(): Promise<Record<string, StructuredToolInterface>> {
  const mcpTools = await listMcpTools();
  const out: Record<string, StructuredToolInterface> = {};

  for (const mcpTool of mcpTools) {
    if (ACTIONS_REQUIRING_APPROVAL.has(mcpTool.name)) continue;
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