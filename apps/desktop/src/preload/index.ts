import { contextBridge, ipcRenderer } from "electron";
import type { DirectoryEntry } from "../main/ipc/fs-ipc.js";
import type { CodingAgentAnswer, EditorContext } from "../main/agent/coding-agent.graph.js";
import type { PendingFileChange } from "../main/agent/approval-broker.js";

const api = {
  openFolder: (): Promise<string | null> => ipcRenderer.invoke("project:open-folder"),
  getProjectRoot: (): Promise<string | null> => ipcRenderer.invoke("project:get-root"),

  readDirectory: (path: string): Promise<DirectoryEntry[]> => ipcRenderer.invoke("fs:read-directory", path),
  readFile: (path: string): Promise<string> => ipcRenderer.invoke("fs:read-file", path),
  saveFile: (path: string, content: string): Promise<void> => ipcRenderer.invoke("fs:save-file", path, content),

  sendMessage: (message: string, editorContext?: EditorContext): Promise<CodingAgentAnswer> =>
    ipcRenderer.invoke("agent:send-message", message, editorContext),

  onExternalFileChange: (callback: (paths: string[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, paths: string[]) => callback(paths);
    ipcRenderer.on("fs:external-change", listener);
    return () => ipcRenderer.removeListener("fs:external-change", listener);
  },

  /** Fires when the agent wants to write/edit/delete a file and is waiting on your decision. */
  onPendingChange: (callback: (change: PendingFileChange) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, change: PendingFileChange) => callback(change);
    ipcRenderer.on("agent:pending-change", listener);
    return () => ipcRenderer.removeListener("agent:pending-change", listener);
  },
  respondToPendingChange: (id: string, approved: boolean): void => {
    ipcRenderer.send("agent:respond-to-pending-change", id, approved);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type DesktopApi = typeof api;