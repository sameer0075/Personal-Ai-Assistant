import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { resolveSafePath, toProjectRelative } from "../security/path-guard.js";

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "out", "coverage", ".turbo", ".cache"]);

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
}

/**
 * Lists a directory inside a root (prefixed path, e.g. "frontend/src"), or all
 * roots when given "." (virtual top level, one entry per workspace root).
 */
export async function listDirectory(prefixedPath: string): Promise<DirectoryEntry[]> {
  if (prefixedPath === ".") {
    return env.WORKSPACE_ROOTS.map((r) => ({ name: r.name, type: "directory" as const }));
  }

  const { abs } = resolveSafePath(prefixedPath);
  const entries = await fs.readdir(abs, { withFileTypes: true });

  return entries
    .filter((e) => !IGNORE_DIRS.has(e.name))
    .map((e): DirectoryEntry => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
}

/**
 * Returns file content with line numbers prefixed (matching the display
 * convention used elsewhere in this project) so the model can reference exact
 * lines. The prefix is display-only - editFile's oldStr must NOT include it,
 * same caveat as any line-numbered view.
 */
export async function readFile(prefixedPath: string): Promise<string> {
  const { abs } = resolveSafePath(prefixedPath);
  const content = await fs.readFile(abs, "utf-8");

  const lines = content.split("\n");
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width)}\t${line}`).join("\n");
}

/** Creates or fully overwrites a file. Parent directories are created as needed. */
export async function writeFile(prefixedPath: string, content: string): Promise<void> {
  const { abs } = resolveSafePath(prefixedPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf-8");
}

/**
 * Precise find-and-replace edit: oldStr must appear exactly once in the file.
 * This is deliberately the same contract as a careful manual edit (and as
 * Claude's own file-editing tool) - it fails loudly on zero or multiple
 * matches rather than guessing, which is what makes AI-driven edits safe to
 * apply directly instead of requiring the model to regenerate the whole file.
 */
export async function editFile(prefixedPath: string, oldStr: string, newStr: string): Promise<void> {
  const { abs, prefixed } = resolveSafePath(prefixedPath);
  const content = await fs.readFile(abs, "utf-8");

  const occurrences = content.split(oldStr).length - 1;

  if (occurrences === 0) {
    throw new Error(`oldStr not found in ${prefixed} - it must match the file's exact current content, verbatim.`);
  }
  if (occurrences > 1) {
    throw new Error(
      `oldStr appears ${occurrences} times in ${prefixed} - it must be unique. Include more surrounding context to disambiguate.`
    );
  }

  const updated = content.replace(oldStr, newStr);
  await fs.writeFile(abs, updated, "utf-8");
}

export async function deleteFile(prefixedPath: string): Promise<void> {
  const { abs } = resolveSafePath(prefixedPath);
  await fs.rm(abs, { recursive: true, force: false });
}

export async function createDirectory(prefixedPath: string): Promise<void> {
  const { abs } = resolveSafePath(prefixedPath);
  await fs.mkdir(abs, { recursive: true });
}

export interface SearchMatch {
  file: string;
  line: number;
  snippet: string;
}

/** Recursive substring search across text files - not regex, kept dependency-free and predictable. */
export async function searchFiles(query: string, subPath = "."): Promise<SearchMatch[]> {
  const roots = subPath === "." ? env.WORKSPACE_ROOTS.map((r) => r.root) : [resolveSafePath(subPath).abs];
  const matches: SearchMatch[] = [];
  const MAX_MATCHES = 100;

  async function walk(dir: string): Promise<void> {
    if (matches.length >= MAX_MATCHES) return;

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (matches.length >= MAX_MATCHES) return;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      let content: string;
      try {
        content = await fs.readFile(fullPath, "utf-8");
      } catch {
        continue; // binary or unreadable file - skip rather than fail the whole search
      }

      content.split("\n").forEach((line, i) => {
        if (matches.length >= MAX_MATCHES) return;
        if (line.includes(query)) {
          matches.push({ file: toProjectRelative(fullPath), line: i + 1, snippet: line.trim().slice(0, 200) });
        }
      });
    }
  }

  for (const root of roots) await walk(root);
  return matches;
}