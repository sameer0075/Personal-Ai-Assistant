import { ipcMain } from "electron";
import { promises as fs } from "node:fs";
import { resolveUiSafePath } from "../security/ui-path-guard.js";
import { getWorkspace } from "../state/project-state.js";

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
}

export function registerFsIpc(): void {
  ipcMain.handle(
    "fs:read-directory",
    async (_event, workspaceId: string, prefixedPath: string): Promise<DirectoryEntry[]> => {
      // Listing "." shows the workspace's roots (virtual top level), one per repo.
      if (prefixedPath === ".") {
        const workspace = getWorkspace(workspaceId);
        if (!workspace) return [];
        return workspace.roots.map((r) => ({ name: r.name, type: "directory" as const }));
      }

      const target = resolveUiSafePath(workspaceId, prefixedPath);
      const entries = await fs.readdir(target, { withFileTypes: true });
      return entries
        .filter((e) => !IGNORE_DIRS.has(e.name))
        .map((e): DirectoryEntry => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" }))
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
    }
  );

  ipcMain.handle("fs:read-file", async (_event, workspaceId: string, prefixedPath: string): Promise<string> => {
    const target = resolveUiSafePath(workspaceId, prefixedPath);
    return fs.readFile(target, "utf-8");
  });

  ipcMain.handle(
    "fs:save-file",
    async (_event, workspaceId: string, prefixedPath: string, content: string): Promise<void> => {
      const target = resolveUiSafePath(workspaceId, prefixedPath);
      await fs.writeFile(target, content, "utf-8");
    }
  );
}