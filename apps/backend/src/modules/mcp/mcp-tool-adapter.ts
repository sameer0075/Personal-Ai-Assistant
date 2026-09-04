import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { listMcpTools, callMcpTool } from "./mcp-client.service.js";
import { mcpInputSchemaToZod } from "./mcp-schema-to-zod.js";

const ACTIONS_REQUIRING_APPROVAL = new Set(["gmail_send_message","gmail_send_bulk", "linkedin_create_post"]);

export async function loadMcpToolsForAgent(): Promise<StructuredToolInterface[]> {
  const mcpTools = await listMcpTools();

  return mcpTools
    .filter((mcpTool) => !ACTIONS_REQUIRING_APPROVAL.has(mcpTool.name))
    .map((mcpTool) =>
      tool(
        async (input: unknown, config?: RunnableConfig) => {
          const userId = config?.configurable?.userId as string | undefined;
          const args = { ...(input as Record<string, unknown> ?? {}), userId };
          return callMcpTool(mcpTool.name, args);
        },
        {
          name: mcpTool.name,
          description: mcpTool.description ?? `${mcpTool.name} (MCP tool)`,
          schema: mcpInputSchemaToZod(mcpTool.inputSchema),
        }
      )
    );
}