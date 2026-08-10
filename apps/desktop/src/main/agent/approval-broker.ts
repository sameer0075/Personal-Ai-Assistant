import { randomUUID } from "node:crypto";
import { getMainWindow } from "../state/window-state.js";

export type FileMutatingTool = "write_file" | "edit_file" | "delete_file" | "create_directory";

export interface PendingFileChange {
  id: string;
  tool: FileMutatingTool;
  path: string;
  /** Current file content, or null if the file doesn't exist yet / isn't diffable (e.g. create_directory). */
  before: string | null;
  /** Proposed content after the change, or null for delete_file / create_directory (nothing to diff). */
  after: string | null;
  summary: string;
}

const pendingResolvers = new Map<string, (approved: boolean) => void>();

/**
 * Sends a proposed change to the renderer and returns a promise that only
 * resolves once the user clicks Approve/Reject there. The calling tool
 * (see mcp-tool-adapter.ts) awaits this before actually performing the write -
 * that's the entire mechanism behind "ask before applying".
 */
export function requestApproval(change: Omit<PendingFileChange, "id">): Promise<boolean> {
  const id = randomUUID();

  return new Promise((resolve) => {
    pendingResolvers.set(id, resolve);
    getMainWindow()?.webContents.send("agent:pending-change", { ...change, id });
  });
}

export function resolvePendingChange(id: string, approved: boolean): void {
  const resolve = pendingResolvers.get(id);
  if (!resolve) return; // already resolved, or a stale/unknown id - ignore rather than throw
  pendingResolvers.delete(id);
  resolve(approved);
}