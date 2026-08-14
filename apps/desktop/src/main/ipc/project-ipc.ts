import { ipcMain, dialog } from "electron";
import {
  addProject,
  removeProject,
  setActiveProject,
  listProjects,
  getActiveProjectId,
  type ProjectInfo,
} from "../state/project-state.js";
import { getMainWindow } from "../state/window-state.js";
import { connectProjectFilesystem, disconnectProjectFilesystem } from "../mcp/mcp-client.service.js";
import { buildCodingAgentForProject, disposeCodingAgentForProject } from "../agent/coding-agent.graph.js";
import { cancelPendingConfirmationsForProject } from "../agent/tool-confirmation.service.js";

export function registerProjectIpc(): void {
  ipcMain.handle("project:open-folder", async (): Promise<ProjectInfo | null> => {
    const win = getMainWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;

    return openProject(result.filePaths[0]);
  });

  ipcMain.handle("project:list", (): ProjectInfo[] => listProjects());

  ipcMain.handle("project:get-active", (): string | null => getActiveProjectId());

  ipcMain.handle("project:switch", (_event, projectId: string): void => {
    setActiveProject(projectId);
  });

  ipcMain.handle("project:close", async (_event, projectId: string): Promise<void> => {
    cancelPendingConfirmationsForProject(projectId);
    await disconnectProjectFilesystem(projectId);
    disposeCodingAgentForProject(projectId);
    removeProject(projectId);
  });
}

/** Full sequence for opening a project: register it, spawn its own scoped
 * filesystem MCP server, then build its own agent instance. */
export async function openProject(root: string): Promise<ProjectInfo> {
  const project = addProject(root);
  await connectProjectFilesystem(project.id, project.root);
  await buildCodingAgentForProject(project.id, project.root);
  return project;
}