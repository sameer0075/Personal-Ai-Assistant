import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveSafePath, toProjectRelative } from "../security/path-guard.js";

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "out", "coverage", ".turbo", ".cache"]);

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
}

export async function listDirectory(relativePath: string): Promise<DirectoryEntry[]> {
  const target = resolveSafePath(relativePath);
  const entries = await fs.readdir(target, { withFileTypes: true });

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
export async function readFile(relativePath: string): Promise<string> {
  const target = resolveSafePath(relativePath);
  const content = await fs.readFile(target, "utf-8");

  const lines = content.split("\n");
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width)}\t${line}`).join("\n");
}

/** Creates or fully overwrites a file. Parent directories are created as needed. */
export async function writeFile(relativePath: string, content: string): Promise<void> {
  const target = resolveSafePath(relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf-8");
}

/**
 * Precise find-and-replace edit: oldStr must appear exactly once in the file.
 * This is deliberately the same contract as a careful manual edit (and as
 * Claude's own file-editing tool) - it fails loudly on zero or multiple
 * matches rather than guessing, which is what makes AI-driven edits safe to
 * apply directly instead of requiring the model to regenerate the whole file.
 */
export async function editFile(relativePath: string, oldStr: string, newStr: string): Promise<void> {
  const target = resolveSafePath(relativePath);
  const content = await fs.readFile(target, "utf-8");

  const occurrences = content.split(oldStr).length - 1;

  if (occurrences === 0) {
    throw new Error(`oldStr not found in ${relativePath} - it must match the file's exact current content, verbatim.`);
  }
  if (occurrences > 1) {
    throw new Error(
      `oldStr appears ${occurrences} times in ${relativePath} - it must be unique. Include more surrounding context to disambiguate.`
    );
  }

  const updated = content.replace(oldStr, newStr);
  await fs.writeFile(target, updated, "utf-8");
}

export async function deleteFile(relativePath: string): Promise<void> {
  const target = resolveSafePath(relativePath);
  await fs.rm(target, { recursive: true, force: false });
}

export async function createDirectory(relativePath: string): Promise<void> {
  const target = resolveSafePath(relativePath);
  await fs.mkdir(target, { recursive: true });
}

export interface SearchMatch {
  file: string;
  line: number;
  snippet: string;
}

/** Simple recursive substring search across text files - not regex, kept dependency-free and predictable. */
export async function searchFiles(query: string, subPath = "."): Promise<SearchMatch[]> {
  const root = resolveSafePath(subPath);
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

  await walk(root);
  return matches;
}