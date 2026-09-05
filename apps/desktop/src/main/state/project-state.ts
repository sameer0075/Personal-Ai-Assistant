import { randomUUID } from "node:crypto";
import path from "node:path";

/**
 * A "project" is now a WORKSPACE: one shared chat + agent over one or more
 * folders (repos), e.g. the frontend and backend repos of the same product.
 * The agent reads/edits every root via paths prefixed with the root's short
 * name ("frontend/src/App.tsx"), Cursor multi-root style.
 */
export interface WorkspaceRoot {
  /** Short unique name used to prefix file paths, e.g. "frontend". */
  name: string;
  /** Absolute root path. */
  root: string;
}

export interface WorkspaceInfo {
  id: string;
  /** Stable identity for chat-history persistence: sorted root paths. */
  key: string;
  /** Display name - the first root's basename. */
  name: string;
  roots: WorkspaceRoot[];
}

const workspaces = new Map<string, WorkspaceInfo>();
let activeWorkspaceId: string | null = null;

/** Derives a fresh, human-friendly display name for the given root path. */
function displayName(root: string): string {
  return path.basename(root) || root;
}

/** Derives a globally stable key for non-UUID identity (chat persistence). */
function workspaceKey(roots: WorkspaceRoot[]): string {
  return roots
    .map((r) => r.root)
    .sort()
    .join("\n");
}

/** Builds a unique within-workspace root name from a folder's basename. */
function uniqueRootName(base: string, existing: WorkspaceRoot[]): string {
  const cleaned = (base || "repo").replace(/[^a-zA-Z0-9_-]/g, "-");
  let candidate = cleaned;
  let suffix = 2;
  while (existing.some((r) => r.name === candidate)) {
    candidate = `${cleaned}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function findWorkspaceByRoot(root: string): WorkspaceInfo | undefined {
  return [...workspaces.values()].find((w) => w.roots.some((r) => r.root === root));
}

/** Creates a new workspace containing a single root folder. */
export function createWorkspace(rootPath: string): WorkspaceInfo {
  const existing = findWorkspaceByRoot(rootPath);
  if (existing) {
    activeWorkspaceId = existing.id;
    return existing;
  }

  const workspace: WorkspaceInfo = {
    id: randomUUID(),
    key: workspaceKey([{ name: uniqueRootName(displayName(rootPath), []), root: rootPath }]),
    name: displayName(rootPath),
    roots: [{ name: uniqueRootName(displayName(rootPath), []), root: rootPath }],
  };
  workspaces.set(workspace.id, workspace);
  activeWorkspaceId = workspace.id;
  return workspace;
}

/** Adds another repo (root folder) to an existing workspace, sharing its chat + agent. */
export function addRootToWorkspace(workspaceId: string, rootPath: string): WorkspaceInfo {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) throw new Error(`Unknown workspace id "${workspaceId}"`);

  if (workspace.roots.some((r) => r.root === rootPath)) {
    activeWorkspaceId = workspace.id;
    return workspace; // already a member - just activate it
  }

  // A folder can belong to at most one open workspace.
  const other = findWorkspaceByRoot(rootPath);
  if (other && other.id !== workspaceId) {
    activeWorkspaceId = other.id;
    throw new Error(`"${rootPath}" is already part of workspace "${other.name}".`);
  }

  workspace.roots = [
    ...workspace.roots,
    { name: uniqueRootName(displayName(rootPath), workspace.roots), root: rootPath },
  ];
  workspace.key = workspaceKey(workspace.roots);
  activeWorkspaceId = workspace.id;
  return workspace;
}

export function removeWorkspace(id: string): void {
  workspaces.delete(id);
  if (activeWorkspaceId === id) {
    const remaining = [...workspaces.keys()];
    activeWorkspaceId = remaining.length ? remaining[remaining.length - 1] : null;
  }
}

/**
 * Removes one repo (root folder) from a workspace, recomputing the workspace's
 * persistent identity (its key = sorted root paths). The caller must ensure at
 * least two roots remain — removing the last repo should close the workspace
 * instead (handled in project-ipc).
 */
export function removeRootFromWorkspace(workspaceId: string, rootName: string): WorkspaceInfo {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) throw new Error(`Unknown workspace id "${workspaceId}"`);
  if (workspace.roots.length <= 1) {
    throw new Error(`Cannot remove the last repo from "${workspace.name}" - close the workspace instead.`);
  }

  const remaining = workspace.roots.filter((r) => r.name !== rootName);
  if (remaining.length === workspace.roots.length) throw new Error(`No repo named "${rootName}" in this workspace.`);

  workspace.roots = remaining;
  workspace.key = workspaceKey(workspace.roots);
  return workspace;
}

export function setActiveWorkspace(id: string): void {
  if (!workspaces.has(id)) throw new Error(`Unknown workspace id "${id}"`);
  activeWorkspaceId = id;
}

export function getWorkspace(id: string): WorkspaceInfo | undefined {
  return workspaces.get(id);
}

export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId;
}

export function listWorkspaces(): WorkspaceInfo[] {
  return [...workspaces.values()];
}