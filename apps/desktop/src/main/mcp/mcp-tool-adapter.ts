import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { promises as fs } from "node:fs";
import { listMcpToolsForWorkspace, callMcpToolForWorkspace } from "./mcp-client.service.js";
import { mcpInputSchemaToZod } from "./mcp-schema-to-zod.js";
import { requestApproval, type FileMutatingTool } from "../agent/approval-broker.js";
import { FILE_MUTATING_TOOLS } from "../agent/mutating-tools.js";
import { resolveUiSafePath } from "../security/ui-path-guard.js";

const SUMMARY_BY_TOOL: Record<FileMutatingTool, (fileExists: boolean) => string> = {
  write_file: (fileExists) => (fileExists ? "Overwrite file" : "Create file"),
  edit_file: () => "Edit file",
  delete_file: () => "Delete",
  create_directory: () => "Create directory",
};

/** Reads a file's raw current content for diffing, or null if it doesn't exist yet. */
async function readCurrentContent(workspaceId: string, relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(resolveUiSafePath(workspaceId, relativePath), "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Builds a preview of what edit_file's single find-and-replace will produce,
 * mirroring file-operations.ts's own validation exactly (same "must match
 * exactly once" rule) so the diff shown for approval is the diff that will
 * actually be applied - not a guess.
 */
function previewEdit(before: string, oldStr: string, newStr: string): string | null {
  const occurrences = before.split(oldStr).length - 1;
  if (occurrences !== 1) return null; // let the real tool call surface the "not found"/"not unique" error
  return before.replace(oldStr, newStr);
}

/**
 * Shows the user a VS Code-style diff (via the PendingChangeDialog modal) for
 * any file-mutating tool call and blocks until they approve or reject it -
 * this is what makes AI-driven writes/edits/deletes safe to apply directly.
 */
async function requestFileChangeApproval(
  workspaceId: string,
  toolName: FileMutatingTool,
  input: Record<string, unknown>
): Promise<boolean> {
  const path = typeof input.path === "string" ? input.path : "unknown";
  const before = await readCurrentContent(workspaceId, path);

  let after: string | null = null;
  if (toolName === "write_file" && typeof input.content === "string") {
    after = input.content;
  } else if (toolName === "edit_file" && before !== null && typeof input.oldStr === "string" && typeof input.newStr === "string") {
    after = previewEdit(before, input.oldStr, input.newStr);
  }

  return requestApproval({
    workspaceId,
    tool: toolName,
    path,
    before,
    after,
    summary: SUMMARY_BY_TOOL[toolName](before !== null),
  });
}

export async function loadMcpToolsForWorkspace(workspaceId: string): Promise<StructuredToolInterface[]> {
  const mcpTools = await listMcpToolsForWorkspace(workspaceId);

  return mcpTools.map((mcpTool) =>
    tool(
      async (input: unknown) => {
        if (FILE_MUTATING_TOOLS.has(mcpTool.name)) {
          const approved = await requestFileChangeApproval(
            workspaceId,
            mcpTool.name as FileMutatingTool,
            (input ?? {}) as Record<string, unknown>
          );
          if (!approved) {
            // Returned as a normal tool result, not thrown - the agent sees
            // this as information and can adapt (ask what you'd prefer)
            // instead of the turn crashing.
            return `The user declined this ${mcpTool.name} action. Do not retry it without being asked again. Tell the user you were blocked and ask how they'd like to proceed.`;
          }
        }
        return callMcpToolForWorkspace(workspaceId, mcpTool.name, (input ?? {}) as Record<string, unknown>);
      },
      {
        name: mcpTool.name,
        description: mcpTool.description ?? `${mcpTool.name} (MCP tool)`,
        schema: mcpInputSchemaToZod(mcpTool.inputSchema),
      }
    )
  );
}