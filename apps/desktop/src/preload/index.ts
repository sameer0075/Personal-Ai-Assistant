import { contextBridge, ipcRenderer } from "electron";
import type { DirectoryEntry } from "../main/ipc/fs-ipc.js";
import type { CodingAgentAnswer } from "../main/agent/coding-agent.graph.js";
import type { ProjectInfo } from "../main/state/project-state.js";

export interface AgentMessageContext {
  activeFilePath: string | null;
  openFilePaths: string[];
}

export interface StoredChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; input: unknown; output?: string }[];
  isError?: boolean;
}

export interface ToolConfirmationRequest {
  requestId: string;
  projectId: string;
  tool: string;
  input: unknown;
}

const api = {
  openFolder: (): Promise<ProjectInfo | null> => ipcRenderer.invoke("project:open-folder"),
  listProjects: (): Promise<ProjectInfo[]> => ipcRenderer.invoke("project:list"),
  getActiveProject: (): Promise<string | null> => ipcRenderer.invoke("project:get-active"),
  switchProject: (projectId: string): Promise<void> => ipcRenderer.invoke("project:switch", projectId),
  closeProject: (projectId: string): Promise<void> => ipcRenderer.invoke("project:close", projectId),

  readDirectory: (projectId: string, path: string): Promise<DirectoryEntry[]> =>
    ipcRenderer.invoke("fs:read-directory", projectId, path),
  readFile: (projectId: string, path: string): Promise<string> =>
    ipcRenderer.invoke("fs:read-file", projectId, path),
  saveFile: (projectId: string, path: string, content: string): Promise<void> =>
    ipcRenderer.invoke("fs:save-file", projectId, path, content),
  getChatHistory: (projectId: string): Promise<StoredChatMessage[]> =>
    ipcRenderer.invoke("agent:get-history", projectId),
  clearChatHistory: (projectId: string): Promise<void> =>
    ipcRenderer.invoke("agent:clear-history", projectId),

  sendMessage: (
    projectId: string,
    message: string,
    context?: AgentMessageContext
  ): Promise<CodingAgentAnswer> => ipcRenderer.invoke("agent:send-message", projectId, message, context),

  /** Fires with the projectId whose files changed, so the renderer only refreshes that project's UI. */
  onExternalFileChange: (callback: (projectId: string, paths: string[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, projectId: string, paths: string[]) =>
      callback(projectId, paths);
    ipcRenderer.on("fs:external-change", listener);
    return () => ipcRenderer.removeListener("fs:external-change", listener);
  },
  onToolConfirmationRequest: (callback: (request: ToolConfirmationRequest) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, request: ToolConfirmationRequest) => callback(request);
    ipcRenderer.on("agent:tool-confirmation-request", listener);
    return () => ipcRenderer.removeListener("agent:tool-confirmation-request", listener);
  },

  respondToToolConfirmation: (requestId: string, approved: boolean): Promise<void> =>
    ipcRenderer.invoke("agent:confirm-tool", requestId, approved),
};

contextBridge.exposeInMainWorld("api", api);

export type DesktopApi = typeof api;