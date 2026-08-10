import { existsSync, statSync } from "node:fs";
import path from "node:path";

function resolveProjectRoot(): string {
  const raw = process.env.PROJECT_ROOT;

  if (!raw) {
    console.error("❌ [mcp-filesystem] PROJECT_ROOT env var is required (the folder this server is scoped to)");
    process.exit(1);
  }

  const resolved = path.resolve(raw);

  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    console.error(`❌ [mcp-filesystem] PROJECT_ROOT "${resolved}" does not exist or is not a directory`);
    process.exit(1);
  }

  return resolved;
}

export const env = {
  PROJECT_ROOT: resolveProjectRoot(),
};