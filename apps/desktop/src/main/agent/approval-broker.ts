import { randomUUID } from "node:crypto";
import { getMainWindow } from "../state/window-state.js";

export type FileMutatingTool = "write_file" | "edit_file" | "delete_file" | "create_directory";

export interface PendingFileChange {
  id: string;
  projectId: string;
  tool: FileMutatingTool;
  path: string;
  /** Current file content, or null if the file doesn't exist yet / isn't diffable (e.g. create_directory). */
  before: string | null;
  /** Proposed content after the change, or null for delete_file / create_directory (nothing to diff). */
  after: string | null;
  summary: string;
}

interface Resolver {
  projectId: string;
  resolve: (approved: boolean) => void;
}

const pendingResolvers = new Map<string, Resolver>();

/**
 * Sends a proposed change to the renderer and returns a promise that only
 * resolves once the user clicks Approve/Reject there. The calling tool
 * (see mcp-tool-adapter.ts) awaits this before actually performing the write -
 * that's the entire mechanism behind "ask before applying".
 */
export function requestApproval(change: Omit<PendingFileChange, "id">): Promise<boolean> {
  const id = randomUUID();

  return new Promise((resolve) => {
    pendingResolvers.set(id, { projectId: change.projectId, resolve });
    getMainWindow()?.webContents.send("agent:pending-change", { ...change, id });
  });
}

export function resolvePendingChange(id: string, approved: boolean): void {
  const resolver = pendingResolvers.get(id);
  if (!resolver) return; // already resolved, or a stale/unknown id - ignore rather than throw
  pendingResolvers.delete(id);
  resolver.resolve(approved);
}

/** Closing a project shouldn't leave a tool call hanging forever waiting on
 * an approval the user will never see again - treat it as declined. */
export function cancelPendingChangesForProject(projectId: string): void {
  for (const [id, resolver] of pendingResolvers) {
    if (resolver.projectId === projectId) {
      pendingResolvers.delete(id);
      resolver.resolve(false);
    }
  }
}