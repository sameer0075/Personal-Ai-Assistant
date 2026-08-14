import { ipcMain } from "electron";
import { promises as fs } from "node:fs";
import { resolveUiSafePath } from "../security/ui-path-guard.js";

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
}

export function registerFsIpc(): void {
  ipcMain.handle(
    "fs:read-directory",
    async (_event, projectId: string, relativePath: string): Promise<DirectoryEntry[]> => {
      const target = resolveUiSafePath(projectId, relativePath);
      const entries = await fs.readdir(target, { withFileTypes: true });
      return entries
        .filter((e) => !IGNORE_DIRS.has(e.name))
        .map((e): DirectoryEntry => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" }))
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
    }
  );

  ipcMain.handle("fs:read-file", async (_event, projectId: string, relativePath: string): Promise<string> => {
    const target = resolveUiSafePath(projectId, relativePath);
    return fs.readFile(target, "utf-8");
  });

  ipcMain.handle(
    "fs:save-file",
    async (_event, projectId: string, relativePath: string, content: string): Promise<void> => {
      const target = resolveUiSafePath(projectId, relativePath);
      await fs.writeFile(target, content, "utf-8");
    }
  );
}