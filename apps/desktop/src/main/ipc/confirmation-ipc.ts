import { ipcMain } from "electron";
import { resolveToolConfirmation } from "../agent/tool-confirmation.service.js";

export function registerConfirmationIpc(): void {
  ipcMain.handle("agent:confirm-tool", (_event, requestId: string, approved: boolean): void => {
    resolveToolConfirmation(requestId, approved);
  });
}