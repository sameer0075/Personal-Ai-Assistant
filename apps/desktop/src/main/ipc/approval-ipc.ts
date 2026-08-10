import { ipcMain } from "electron";
import { resolvePendingChange } from "../agent/approval-broker.js";

export function registerApprovalIpc(): void {
  // Fire-and-forget from the renderer's side (it's not waiting on a return
  // value) - the actual "response" is resolvePendingChange() unblocking the
  // promise that the tool call in mcp-tool-adapter.ts is awaiting.
  ipcMain.on("agent:respond-to-pending-change", (_event, id: string, approved: boolean) => {
    resolvePendingChange(id, approved);
  });
}