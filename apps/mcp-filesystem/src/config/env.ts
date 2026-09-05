import { existsSync, statSync } from "node:fs";
import path from "node:path";

export interface WorkspaceRoot {
  /** Stable short name used to prefix paths, e.g. "frontend". Must be unique. */
  name: string;
  root: string;
}

/**
 * A workspace is a set of folders (repos) the agent may read/edit at once. Each
 * entry is `name=absolutePath`, one per line. Example:
 *
 *   WORKSPACE_ROOTS="\
 *   frontend=/Users/me/app/web\n\
 *   backend=/Users/me/app/api"
 *
 * All file tool paths are prefixed with a root name, e.g. "frontend/src/App.tsx",
 * so the agent can reference multiple repos unambiguously in one chat.
 */
function resolveWorkspaceRoots(): WorkspaceRoot[] {
  const raw = process.env.WORKSPACE_ROOTS;

  if (!raw) {
    console.error(
      "❌ [mcp-filesystem] WORKSPACE_ROOTS env var is required (one 'name=absolutePath' per line, newline-separated)"
    );
    process.exit(1);
  }

  const entries: WorkspaceRoot[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      console.error(`❌ [mcp-filesystem] WORKSPACE_ROOTS entry "${trimmed}" must be 'name=absolutePath'`);
      process.exit(1);
    }

    const name = trimmed.slice(0, eq).trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      console.error(`❌ [mcp-filesystem] root name "${name}" must be alphanumeric, dashes or underscores only`);
      process.exit(1);
    }

    const resolved = path.resolve(trimmed.slice(eq + 1).trim());

    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      console.error(`❌ [mcp-filesystem] root "${name}" ("${resolved}") does not exist or is not a directory`);
      process.exit(1);
    }

    if (entries.some((e) => e.name === name)) {
      console.error(`❌ [mcp-filesystem] duplicate root name "${name}"`);
      process.exit(1);
    }

    entries.push({ name, root: resolved });
  }

  if (entries.length === 0) {
    console.error("❌ [mcp-filesystem] WORKSPACE_ROOTS had no valid entries");
    process.exit(1);
  }

  return entries;
}

export const env = {
  WORKSPACE_ROOTS: resolveWorkspaceRoots(),
};