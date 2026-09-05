import { ipcMain, dialog } from "electron";
import {
  createWorkspace,
  addRootToWorkspace,
  removeRootFromWorkspace,
  removeWorkspace,
  setActiveWorkspace,
  listWorkspaces,
  getActiveWorkspaceId,
  type WorkspaceInfo,
} from "../state/project-state.js";
import { getMainWindow } from "../state/window-state.js";
import { connectWorkspaceFilesystem, disconnectWorkspaceFilesystem } from "../mcp/mcp-client.service.js";
import { buildCodingAgentForWorkspace, disposeCodingAgentForWorkspace } from "../agent/coding-agent.graph.js";
import { cancelPendingConfirmationsForWorkspace } from "../agent/tool-confirmation.service.js";
import { cancelPendingChangesForWorkspace } from "../agent/approval-broker.js";

async function pickDirectory(prompt = "Select a folder"): Promise<string | null> {
  const win = getMainWindow();
  if (!win) return null;

  const result = await dialog.showOpenDialog(win, {
    title: prompt,
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

async function spinUpWorkspace(workspace: WorkspaceInfo): Promise<void> {
  await connectWorkspaceFilesystem(workspace.id, workspace.roots);
  await buildCodingAgentForWorkspace({
    workspaceId: workspace.id,
    workspaceKey: workspace.key,
    workspaceName: workspace.name,
    roots: workspace.roots.map((r) => r.name),
  });
}

export function registerProjectIpc(): void {
  ipcMain.handle("project:open-folder", async (): Promise<WorkspaceInfo | null> => {
    const root = await pickDirectory("Select a folder to open as a new workspace");
    if (!root) return null;

    const workspace = createWorkspace(root);
    await spinUpWorkspace(workspace);
    return workspace;
  });

  /** Adds another repo/folder to the given workspace so it shares the chat. */
  ipcMain.handle("project:add-root", async (_event, workspaceId: string): Promise<WorkspaceInfo> => {
    const root = await pickDirectory("Select a repo folder to add to this workspace");
    if (!root) return { ...getWorkspaceSafe(workspaceId) };

    const workspace = addRootToWorkspace(workspaceId, root);
    // The filesystem server restarts so its WORKSPACE_ROOTS picks up the new root.
    await spinUpWorkspace(workspace);
    return workspace;
  });

  /**
   * Removes one repo from a workspace. Removing the very last repo closes the
   * whole workspace (like VS Code/Cursor closing the last folder in a
   * multi-root window) - returns null in that case so the renderer can tear
   * the workspace down.
   */
  ipcMain.handle(
    "project:remove-root",
    async (_event, workspaceId: string, rootName: string): Promise<WorkspaceInfo | null> => {
      const workspace = getWorkspaceSafe(workspaceId);
      if (workspace.roots.length <= 1) {
        await closeWorkspace(workspaceId);
        return null;
      }

      const updated = removeRootFromWorkspace(workspaceId, rootName);
      // Restart the filesystem server (new WORKSPACE_ROOTS) and rebuild the
      // shared agent so neither knows the removed root anymore.
      await spinUpWorkspace(updated);
      return updated;
    }
  );

  ipcMain.handle("project:list", (): WorkspaceInfo[] => listWorkspaces());

  ipcMain.handle("project:get-active", (): string | null => getActiveWorkspaceId());

  ipcMain.handle("project:switch", (_event, workspaceId: string): void => {
    setActiveWorkspace(workspaceId);
  });

  ipcMain.handle("project:close", async (_event, workspaceId: string): Promise<void> => {
    await closeWorkspace(workspaceId);
  });

  /** Full teardown of a workspace + its filesystem server and agent. */
  async function closeWorkspace(workspaceId: string): Promise<void> {
    cancelPendingConfirmationsForWorkspace(workspaceId);
    cancelPendingChangesForWorkspace(workspaceId);
    await disconnectWorkspaceFilesystem(workspaceId);
    disposeCodingAgentForWorkspace(workspaceId);
    removeWorkspace(workspaceId);
  }

  /** Returns the current (just-updated) workspace for a call that added a root. */
  function getWorkspaceSafe(id: string): WorkspaceInfo {
    const ws = listWorkspaces().find((w) => w.id === id);
    if (!ws) throw new Error("Workspace not found");
    return ws;
  }
}