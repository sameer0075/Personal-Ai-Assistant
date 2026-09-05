import path from "node:path";
import { env, type WorkspaceRoot } from "../config/env.js";

/**
 * Every filesystem tool call goes through this before touching disk. It's the
 * one thing standing between "AI coding agent" and "AI agent that can read/
 * write anywhere on your machine" - so it's deliberately paranoid: resolves
 * the given path against the matching workspace root and rejects anything
 * that resolves outside it, including via `..`, absolute paths, or symlink-
 * style tricks that `path.resolve` would otherwise happily normalize away.
 *
 * Paths are prefixed by root name (e.g. "frontend/src/App.tsx"); the special
 * value "." or "" lists across all roots.
 */

export interface ResolvedSpec {
  root: WorkspaceRoot;
  /** Absolute path inside the root. */
  abs: string;
  /** Path relative to that root, for display. */
  rel: string;
  /** Display form as the agent wrote it, e.g. "frontend/src/App.tsx". */
  prefixed: string;
}

function matchRoot(rootName: string): WorkspaceRoot {
  const root = env.WORKSPACE_ROOTS.find((r) => r.name === rootName);
  if (!root) {
    const names = env.WORKSPACE_ROOTS.map((r) => r.name).join(", ");
    throw new Error(
      `Unknown root "${rootName}". Available roots: ${names}. Prefix paths with a root name, e.g. "${env.WORKSPACE_ROOTS[0].name}/src/index.ts".`
    );
  }
  return root;
}

export function resolveSafePath(prefixedPath: string): ResolvedSpec {
  if (path.isAbsolute(prefixedPath)) {
    throw new Error(
      `Path "${prefixedPath}" is absolute - all paths must be relative to a workspace root, e.g. "frontend/src/index.ts" not "/frontend/src/index.ts".`
    );
  }

  const separator = prefixedPath.indexOf("/");
  if (separator <= 0) {
    // A bare root name means the top of that root, e.g. list_directory("frontend").
    const root = matchRoot(prefixedPath);
    return { root, abs: root.root, rel: ".", prefixed: prefixedPath };
  }

  const rootName = prefixedPath.slice(0, separator);
  const rel = prefixedPath.slice(separator + 1);
  const root = matchRoot(rootName);

  const abs = path.resolve(root.root, rel);
  const isInside = abs === root.root || abs.startsWith(root.root + path.sep);
  if (!isInside) {
    throw new Error(
      `Path "${prefixedPath}" resolves outside root "${root.name}" (${root.root}). Refusing - only files inside a workspace root can be accessed.`
    );
  }

  return { root, abs, rel, prefixed: prefixedPath };
}

/** Converts an absolute path (within any root) back to its prefixed display form. */
export function toProjectRelative(absolutePath: string): string {
  for (const root of env.WORKSPACE_ROOTS) {
    if (absolutePath === root.root) return root.name;
    if (absolutePath.startsWith(root.root + path.sep)) {
      return `${root.name}/${path.relative(root.root, absolutePath)}`;
    }
  }
  return absolutePath;
}
