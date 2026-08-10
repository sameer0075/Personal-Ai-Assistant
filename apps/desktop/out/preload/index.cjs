"use strict";
const electron = require("electron");
const api = {
  openFolder: () => electron.ipcRenderer.invoke("project:open-folder"),
  getProjectRoot: () => electron.ipcRenderer.invoke("project:get-root"),
  readDirectory: (path) => electron.ipcRenderer.invoke("fs:read-directory", path),
  readFile: (path) => electron.ipcRenderer.invoke("fs:read-file", path),
  saveFile: (path, content) => electron.ipcRenderer.invoke("fs:save-file", path, content),
  sendMessage: (message, editorContext) => electron.ipcRenderer.invoke("agent:send-message", message, editorContext),
  onExternalFileChange: (callback) => {
    const listener = (_event, paths) => callback(paths);
    electron.ipcRenderer.on("fs:external-change", listener);
    return () => electron.ipcRenderer.removeListener("fs:external-change", listener);
  },
  /** Fires when the agent wants to write/edit/delete a file and is waiting on your decision. */
  onPendingChange: (callback) => {
    const listener = (_event, change) => callback(change);
    electron.ipcRenderer.on("agent:pending-change", listener);
    return () => electron.ipcRenderer.removeListener("agent:pending-change", listener);
  },
  respondToPendingChange: (id, approved) => {
    electron.ipcRenderer.send("agent:respond-to-pending-change", id, approved);
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
