"use strict";
const electron = require("electron");
const api = {
  openFolder: () => electron.ipcRenderer.invoke("project:open-folder"),
  listProjects: () => electron.ipcRenderer.invoke("project:list"),
  getActiveProject: () => electron.ipcRenderer.invoke("project:get-active"),
  switchProject: (projectId) => electron.ipcRenderer.invoke("project:switch", projectId),
  closeProject: (projectId) => electron.ipcRenderer.invoke("project:close", projectId),
  readDirectory: (projectId, path) => electron.ipcRenderer.invoke("fs:read-directory", projectId, path),
  readFile: (projectId, path) => electron.ipcRenderer.invoke("fs:read-file", projectId, path),
  saveFile: (projectId, path, content) => electron.ipcRenderer.invoke("fs:save-file", projectId, path, content),
  getChatHistory: (projectId) => electron.ipcRenderer.invoke("agent:get-history", projectId),
  clearChatHistory: (projectId) => electron.ipcRenderer.invoke("agent:clear-history", projectId),
  sendMessage: (projectId, message, context) => electron.ipcRenderer.invoke("agent:send-message", projectId, message, context),
  /** Fires with the projectId whose files changed, so the renderer only refreshes that project's UI. */
  onExternalFileChange: (callback) => {
    const listener = (_event, projectId, paths) => callback(projectId, paths);
    electron.ipcRenderer.on("fs:external-change", listener);
    return () => electron.ipcRenderer.removeListener("fs:external-change", listener);
  },
  onToolConfirmationRequest: (callback) => {
    const listener = (_event, request) => callback(request);
    electron.ipcRenderer.on("agent:tool-confirmation-request", listener);
    return () => electron.ipcRenderer.removeListener("agent:tool-confirmation-request", listener);
  },
  respondToToolConfirmation: (requestId, approved) => electron.ipcRenderer.invoke("agent:confirm-tool", requestId, approved),
  /** VS Code-style diff modal for file-mutating tool calls (write_file/edit_file/delete_file/create_directory). */
  onPendingFileChange: (callback) => {
    const listener = (_event, change) => callback(change);
    electron.ipcRenderer.on("agent:pending-change", listener);
    return () => electron.ipcRenderer.removeListener("agent:pending-change", listener);
  },
  respondToPendingFileChange: (id, approved) => electron.ipcRenderer.send("agent:respond-to-pending-change", id, approved)
};
electron.contextBridge.exposeInMainWorld("api", api);
