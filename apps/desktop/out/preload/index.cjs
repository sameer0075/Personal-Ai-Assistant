"use strict";
const electron = require("electron");
const api = {
  openFolder: () => electron.ipcRenderer.invoke("project:open-folder"),
  addRootToWorkspace: (workspaceId) => electron.ipcRenderer.invoke("project:add-root", workspaceId),
  removeRootFromWorkspace: (workspaceId, rootName) => electron.ipcRenderer.invoke("project:remove-root", workspaceId, rootName),
  listProjects: () => electron.ipcRenderer.invoke("project:list"),
  getActiveProject: () => electron.ipcRenderer.invoke("project:get-active"),
  switchProject: (workspaceId) => electron.ipcRenderer.invoke("project:switch", workspaceId),
  closeProject: (workspaceId) => electron.ipcRenderer.invoke("project:close", workspaceId),
  readDirectory: (workspaceId, path) => electron.ipcRenderer.invoke("fs:read-directory", workspaceId, path),
  readFile: (workspaceId, path) => electron.ipcRenderer.invoke("fs:read-file", workspaceId, path),
  saveFile: (workspaceId, path, content) => electron.ipcRenderer.invoke("fs:save-file", workspaceId, path, content),
  getChatHistory: (workspaceId) => electron.ipcRenderer.invoke("agent:get-history", workspaceId),
  clearChatHistory: (workspaceId) => electron.ipcRenderer.invoke("agent:clear-history", workspaceId),
  sendMessage: (workspaceId, message, context) => electron.ipcRenderer.invoke("agent:send-message", workspaceId, message, context),
  /** Fires with the workspaceId whose files changed, so the renderer only refreshes that workspace's UI. */
  onExternalFileChange: (callback) => {
    const listener = (_event, workspaceId, paths) => callback(workspaceId, paths);
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
