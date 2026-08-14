import path from "node:path";
import { getProject } from "../state/project-state.js";

/**
 * Same logic as apps/mcp-filesystem's path-guard.ts, kept as a separate
 * implementation because it serves a different caller: this guards the UI's
 * own direct file-tree/editor IPC handlers (a human clicking around), not
 * the AI agent's tool calls. Now scoped per-project instead of a single
 * global root, since multiple projects can be open at once.
 */
export function resolveUiSafePath(projectId: string, relativePath: string): string {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project "${projectId}" is not open`);
  }

  if (path.isAbsolute(relativePath)) {
    throw new Error(`Path "${relativePath}" is absolute - all paths must be relative to the project root.`);
  }

  const resolved = path.resolve(project.root, relativePath);
  const isInsideRoot = resolved === project.root || resolved.startsWith(project.root + path.sep);

  if (!isInsideRoot) {
    throw new Error(`Path "${relativePath}" resolves outside project "${project.name}".`);
  }

  return resolved;
}