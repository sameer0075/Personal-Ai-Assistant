import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { listMcpToolsForProject, callMcpToolForProject } from "./mcp-client.service.js";
import { mcpInputSchemaToZod } from "./mcp-schema-to-zod.js";
import { requestToolConfirmation } from "../agent/tool-confirmation.service.js";
import { FILE_MUTATING_TOOLS } from "../agent/mutating-tools.js";

export async function loadMcpToolsForProject(projectId: string): Promise<StructuredToolInterface[]> {
  const mcpTools = await listMcpToolsForProject(projectId);

  return mcpTools.map((mcpTool) =>
    tool(
      async (input: unknown) => {
        if (FILE_MUTATING_TOOLS.has(mcpTool.name)) {
          const approved = await requestToolConfirmation(projectId, mcpTool.name, input);
          if (!approved) {
            // Returned as a normal tool result, not thrown - the agent sees
            // this as information and can adapt (ask what you'd prefer)
            // instead of the turn crashing.
            return `The user declined this ${mcpTool.name} action. Do not retry it without being asked again. Tell the user you were blocked and ask how they'd like to proceed.`;
          }
        }
        return callMcpToolForProject(projectId, mcpTool.name, (input ?? {}) as Record<string, unknown>);
      },
      {
        name: mcpTool.name,
        description: mcpTool.description ?? `${mcpTool.name} (MCP tool)`,
        schema: mcpInputSchemaToZod(mcpTool.inputSchema),
      }
    )
  );
}