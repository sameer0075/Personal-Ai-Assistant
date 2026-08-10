import path from "node:path";
import { getProjectRoot } from "../state/project-state.js";

/**
 * Deliberately the same logic as apps/mcp-filesystem's path-guard.ts, kept as
 * a separate implementation because it serves a different caller: this one
 * guards the UI's own direct file-tree/editor IPC handlers (a human clicking
 * around), not the AI agent's tool calls (which go through the MCP server's
 * own, independent copy of this same check). Two callers, two independently
 * enforced boundaries - the AI agent being compromised or buggy doesn't help
 * it escape via the UI's file access path, and vice versa.
 */
export function resolveUiSafePath(relativePath: string): string {
  const root = getProjectRoot();
  if (!root) {
    throw new Error("No project is open");
  }

  if (path.isAbsolute(relativePath)) {
    throw new Error(`Path "${relativePath}" is absolute - all paths must be relative to the project root.`);
  }

  const resolved = path.resolve(root, relativePath);
  const isInsideRoot = resolved === root || resolved.startsWith(root + path.sep);

  if (!isInsideRoot) {
    throw new Error(`Path "${relativePath}" resolves outside the open project.`);
  }

  return resolved;
}