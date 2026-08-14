import { ipcMain } from "electron";
import {
  runCodingAgentForProject,
  getDisplayHistory,
  resetConversationForProject,
  type CodingAgentAnswer,
  type AgentMessageContext,
} from "../agent/coding-agent.graph.js";
import { getMainWindow } from "../state/window-state.js";
import { getProject } from "../state/project-state.js";
import { FILE_MUTATING_TOOLS } from "../agent/mutating-tools.js";

export function registerAgentIpc(): void {
  ipcMain.handle(
    "agent:send-message",
    async (_event, projectId: string, message: string, context?: AgentMessageContext): Promise<CodingAgentAnswer> => {
      const result = await runCodingAgentForProject(projectId, message, context);
      notifyOfFileChanges(projectId, result);
      return result;
    }
  );

  ipcMain.handle("agent:get-history", (_event, projectId: string) => getDisplayHistory(projectId));

  ipcMain.handle("agent:clear-history", async (_event, projectId: string): Promise<void> => {
    await resetConversationForProject(projectId);
  });
}

function notifyOfFileChanges(projectId: string, result: CodingAgentAnswer): void {
  const win = getMainWindow();
  if (!win) return;
  const project = getProject(projectId);
  if (!project) return;

  const changedPaths = result.toolCalls
    .filter((c) => FILE_MUTATING_TOOLS.has(c.tool))
    .map((c) => (c.input as { path?: string })?.path)
    .filter((p): p is string => Boolean(p));

  if (changedPaths.length) {
    win.webContents.send("fs:external-change", projectId, changedPaths);
  }
}