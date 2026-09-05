import { contextBridge, ipcRenderer } from "electron";
import type { DirectoryEntry } from "../main/ipc/fs-ipc.js";
import type { CodingAgentAnswer } from "../main/agent/coding-agent.graph.js";
import type { WorkspaceInfo } from "../main/state/project-state.js";

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
  workspaceId: string;
  tool: string;
  input: unknown;
}

export interface PendingFileChange {
  id: string;
  workspaceId: string;
  tool: "write_file" | "edit_file" | "delete_file" | "create_directory";
  path: string;
  before: string | null;
  after: string | null;
  summary: string;
}

const api = {
  openFolder: (): Promise<WorkspaceInfo | null> => ipcRenderer.invoke("project:open-folder"),
  addRootToWorkspace: (workspaceId: string): Promise<WorkspaceInfo> =>
    ipcRenderer.invoke("project:add-root", workspaceId),
  removeRootFromWorkspace: (workspaceId: string, rootName: string): Promise<WorkspaceInfo | null> =>
    ipcRenderer.invoke("project:remove-root", workspaceId, rootName),
  listProjects: (): Promise<WorkspaceInfo[]> => ipcRenderer.invoke("project:list"),
  getActiveProject: (): Promise<string | null> => ipcRenderer.invoke("project:get-active"),
  switchProject: (workspaceId: string): Promise<void> => ipcRenderer.invoke("project:switch", workspaceId),
  closeProject: (workspaceId: string): Promise<void> => ipcRenderer.invoke("project:close", workspaceId),

  readDirectory: (workspaceId: string, path: string): Promise<DirectoryEntry[]> =>
    ipcRenderer.invoke("fs:read-directory", workspaceId, path),
  readFile: (workspaceId: string, path: string): Promise<string> =>
    ipcRenderer.invoke("fs:read-file", workspaceId, path),
  saveFile: (workspaceId: string, path: string, content: string): Promise<void> =>
    ipcRenderer.invoke("fs:save-file", workspaceId, path, content),
  getChatHistory: (workspaceId: string): Promise<StoredChatMessage[]> =>
    ipcRenderer.invoke("agent:get-history", workspaceId),
  clearChatHistory: (workspaceId: string): Promise<void> =>
    ipcRenderer.invoke("agent:clear-history", workspaceId),

  sendMessage: (
    workspaceId: string,
    message: string,
    context?: AgentMessageContext
  ): Promise<CodingAgentAnswer> => ipcRenderer.invoke("agent:send-message", workspaceId, message, context),

  /** Fires with the workspaceId whose files changed, so the renderer only refreshes that workspace's UI. */
  onExternalFileChange: (callback: (workspaceId: string, paths: string[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, workspaceId: string, paths: string[]) =>
      callback(workspaceId, paths);
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

  /** VS Code-style diff modal for file-mutating tool calls (write_file/edit_file/delete_file/create_directory). */
  onPendingFileChange: (callback: (change: PendingFileChange) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, change: PendingFileChange) => callback(change);
    ipcRenderer.on("agent:pending-change", listener);
    return () => ipcRenderer.removeListener("agent:pending-change", listener);
  },
  respondToPendingFileChange: (id: string, approved: boolean): void =>
    ipcRenderer.send("agent:respond-to-pending-change", id, approved),
};

contextBridge.exposeInMainWorld("api", api);

export type DesktopApi = typeof api;