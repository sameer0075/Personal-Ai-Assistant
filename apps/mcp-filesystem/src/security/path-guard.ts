import path from "node:path";
import { env } from "../config/env.js";

/**
 * Every filesystem tool call goes through this before touching disk. It's the
 * one thing standing between "AI coding agent" and "AI agent that can read/
 * write anywhere on your machine" - so it's deliberately paranoid: resolves
 * the given path against PROJECT_ROOT and rejects anything that resolves
 * outside it, including via `..`, absolute paths, or symlink-style tricks
 * that `path.resolve` would otherwise happily normalize away.
 */
export function resolveSafePath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error(
      `Path "${relativePath}" is absolute - all paths must be relative to the project root, e.g. "src/index.ts" not "/src/index.ts".`
    );
  }

  const resolved = path.resolve(env.PROJECT_ROOT, relativePath);

  const root = env.PROJECT_ROOT;
  const isInsideRoot = resolved === root || resolved.startsWith(root + path.sep);

  if (!isInsideRoot) {
    throw new Error(
      `Path "${relativePath}" resolves outside the open project (${root}). Refusing - only files inside the open project can be accessed.`
    );
  }

  return resolved;
}

/** Converts an absolute path back to one relative to the project root, for display/tool output. */
export function toProjectRelative(absolutePath: string): string {
  return path.relative(env.PROJECT_ROOT, absolutePath) || ".";
}