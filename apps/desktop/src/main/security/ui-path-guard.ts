import path from "node:path";
import { getWorkspace } from "../state/project-state.js";

/**
 * Guards the UI's own file-tree/editor IPC handlers (a human clicking around),
 * scoped per-workspace. A workspace has one or more roots; UI paths are
 * prefixed with the root name ("frontend/src/App.tsx"), and a bare root name
 * refers to the top of that root. Deliberately resolves against the workspace's
 * registered roots and rejects anything outside them, matching the MCP server's
 * own path-guard so both callers agree on the same security boundary.
 */
export function resolveUiSafePath(workspaceId: string, prefixedPath: string): string {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace "${workspaceId}" is not open`);
  }

  if (path.isAbsolute(prefixedPath)) {
    throw new Error(
      `Path "${prefixedPath}" is absolute - all paths must be prefixed with a workspace root name, e.g. "frontend/src/index.ts".`
    );
  }

  const separator = prefixedPath.indexOf("/");
  // A bare root name is the top of that root.
  const rootName = separator <= 0 ? prefixedPath : prefixedPath.slice(0, separator);
  const rel = separator <= 0 ? "" : prefixedPath.slice(separator + 1);

  const root = workspace.roots.find((r) => r.name === rootName);
  if (!root) {
    const names = workspace.roots.map((r) => r.name).join(", ");
    throw new Error(
      `Unknown root "${rootName}" in workspace "${workspace.name}". Available roots: ${names}.`
    );
  }

  const resolved = path.resolve(root.root, rel || ".");
  const isInsideRoot = resolved === root.root || resolved.startsWith(root.root + path.sep);

  if (!isInsideRoot) {
    throw new Error(`Path "${prefixedPath}" resolves outside root "${root.name}".`);
  }

  return resolved;
}