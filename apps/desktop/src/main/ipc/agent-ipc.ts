import { ipcMain } from "electron";
import {
  runCodingAgentForWorkspace,
  getDisplayHistory,
  resetConversationForWorkspace,
  type CodingAgentAnswer,
  type AgentMessageContext,
} from "../agent/coding-agent.graph.js";
import { getMainWindow } from "../state/window-state.js";
import { getWorkspace } from "../state/project-state.js";
import { FILE_MUTATING_TOOLS } from "../agent/mutating-tools.js";

export function registerAgentIpc(): void {
  ipcMain.handle(
    "agent:send-message",
    async (_event, workspaceId: string, message: string, context?: AgentMessageContext): Promise<CodingAgentAnswer> => {
      const result = await runCodingAgentForWorkspace(workspaceId, message, context);
      notifyOfFileChanges(workspaceId, result);
      return result;
    }
  );

  ipcMain.handle("agent:get-history", (_event, workspaceId: string) => getDisplayHistory(workspaceId));

  ipcMain.handle("agent:clear-history", async (_event, workspaceId: string): Promise<void> => {
    await resetConversationForWorkspace(workspaceId);
  });
}

function notifyOfFileChanges(workspaceId: string, result: CodingAgentAnswer): void {
  const win = getMainWindow();
  if (!win) return;
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return;

  const changedPaths = result.toolCalls
    .filter((c) => FILE_MUTATING_TOOLS.has(c.tool))
    .map((c) => (c.input as { path?: string })?.path)
    .filter((p): p is string => Boolean(p));

  if (changedPaths.length) {
    win.webContents.send("fs:external-change", workspaceId, changedPaths);
  }
}