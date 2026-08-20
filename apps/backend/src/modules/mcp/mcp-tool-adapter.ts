import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { listMcpTools, callMcpTool } from "./mcp-client.service.js";
import { mcpInputSchemaToZod } from "./mcp-schema-to-zod.js";

/**
 * MCP tools that actually send/publish something externally. These are
 * deliberately withheld from the agent - the LLM can never call them
 * directly. gmail_draft_message / linkedin_draft_post are what the agent
 * gets instead: they only create a row in pending_actions. The real
 * send/publish only happens from pending-actions.service.ts#approvePendingAction,
 * after a human approves in the UI.
 */
const ACTIONS_REQUIRING_APPROVAL = new Set(["gmail_send_message","gmail_send_bulk", "linkedin_create_post"]);

export async function loadMcpToolsForAgent(): Promise<StructuredToolInterface[]> {
  const mcpTools = await listMcpTools();

  return mcpTools
    .filter((mcpTool) => !ACTIONS_REQUIRING_APPROVAL.has(mcpTool.name))
    .map((mcpTool) =>
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