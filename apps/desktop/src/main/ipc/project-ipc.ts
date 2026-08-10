import { ipcMain, dialog } from "electron";
import { setProjectRootState, getProjectRoot } from "../state/project-state.js";
import { getMainWindow } from "../state/window-state.js";
import * as mcpClient from "../mcp/mcp-client.service.js";
import { rebuildCodingAgent } from "../agent/coding-agent.graph.js";

export function registerProjectIpc(): void {
  ipcMain.handle("project:open-folder", async (): Promise<string | null> => {
    const win = getMainWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;

    const root = result.filePaths[0];
    await openProject(root);
    return root;
  });

  ipcMain.handle("project:get-root", (): string | null => getProjectRoot());
}

/**
 * The full sequence for switching projects: update UI state, respawn the
 * filesystem MCP server scoped to the new root, then rebuild the agent so it
 * picks up the new server's tools (and starts a fresh conversation - see
 * rebuildCodingAgent).
 */
export async function openProject(root: string): Promise<void> {
  setProjectRootState(root);
  await mcpClient.setProjectRoot(root);
  await rebuildCodingAgent();
}