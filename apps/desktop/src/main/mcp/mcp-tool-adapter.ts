import { promises as fs } from "node:fs";
import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { listMcpTools, callMcpTool } from "./mcp-client.service.js";
import { mcpInputSchemaToZod } from "./mcp-schema-to-zod.js";
import { resolveUiSafePath } from "../security/ui-path-guard.js";
import { requestApproval, type FileMutatingTool } from "../agent/approval-broker.js";

const FILE_MUTATING_TOOLS = new Set<FileMutatingTool>(["write_file", "edit_file", "delete_file", "create_directory"]);

/**
 * Reads a file's raw (non-line-numbered) current content for diffing, using
 * the same project-scoped safety boundary as the editor UI's own file
 * access (ui-path-guard.ts) - not the MCP filesystem server's read_file tool,
 * which prefixes line numbers for the model's benefit and isn't meant for this.
 */
async function readCurrentContent(relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(resolveUiSafePath(relativePath), "utf-8");
  } catch {
    return null; // doesn't exist yet, or unreadable (binary, permissions, etc.) - treat as "no prior content"
  }
}

function computeProposedChange(
  toolName: FileMutatingTool,
  args: Record<string, unknown>,
  before: string | null
): { after: string | null; summary: string } {
  switch (toolName) {
    case "write_file":
      return { after: String(args.content ?? ""), summary: before === null ? "Create new file" : "Overwrite file" };
    case "edit_file": {
      const oldStr = String(args.oldStr ?? "");
      const newStr = String(args.newStr ?? "");
      const after = before !== null && before.includes(oldStr) ? before.replace(oldStr, newStr) : null;
      return { after, summary: "Edit file" };
    }
    case "delete_file":
      return { after: null, summary: "Delete file or directory" };
    case "create_directory":
      return { after: null, summary: "Create directory" };
  }
}

export async function loadMcpToolsForAgent(): Promise<StructuredToolInterface[]> {
  const mcpTools = await listMcpTools();

  return mcpTools.map((mcpTool) =>
    tool(
      async (input: unknown) => {
        const args = (input ?? {}) as Record<string, unknown>;

        if (FILE_MUTATING_TOOLS.has(mcpTool.name as FileMutatingTool)) {
          const toolName = mcpTool.name as FileMutatingTool;
          const path = String(args.path ?? "");
          const before = toolName === "create_directory" ? null : await readCurrentContent(path);
          const { after, summary } = computeProposedChange(toolName, args, before);

          const approved = await requestApproval({ tool: toolName, path, before, after, summary });

          if (!approved) {
            return `The user rejected this change (${summary.toLowerCase()} on "${path}"). Do not apply it or try an equivalent workaround - ask what they'd like instead, or move on to something else.`;
          }
        }

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