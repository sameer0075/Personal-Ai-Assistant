import { ipcMain } from "electron";
import { runCodingAgent, type CodingAgentAnswer, type EditorContext } from "../agent/coding-agent.graph.js";
import { getMainWindow } from "../state/window-state.js";

const FILE_MUTATING_TOOLS = new Set(["write_file", "edit_file", "delete_file", "create_directory"]);

export function registerAgentIpc(): void {
  ipcMain.handle(
    "agent:send-message",
    async (_event, message: string, editorContext?: EditorContext): Promise<CodingAgentAnswer> => {
      const result = await runCodingAgent(message, editorContext);
      notifyOfFileChanges(result);
      return result;
    }
  );
}

/**
 * The actual file writes happen inside the separate mcp-filesystem child
 * process, not here - so the main process learns what changed by inspecting
 * which tools the agent called, and tells the renderer to refresh any open
 * editor tab / the file tree for those paths.
 */
function notifyOfFileChanges(result: CodingAgentAnswer): void {
  const changedPaths = result.toolCalls
    .filter((call) => FILE_MUTATING_TOOLS.has(call.tool))
    .map((call) => (call.input as { path?: string })?.path)
    .filter((p): p is string => Boolean(p));

  if (changedPaths.length === 0) return;

  getMainWindow()?.webContents.send("fs:external-change", changedPaths);
}