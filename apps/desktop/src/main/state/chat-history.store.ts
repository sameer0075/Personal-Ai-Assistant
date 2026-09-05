import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export interface StoredChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; input: unknown; output?: string }[];
  isError?: boolean;
}

function historyDir(): string {
  return path.join(app.getPath("userData"), "chat-sessions");
}

// Keyed by the workspace's stable "key" (the sorted list of all its root
// paths) - NOT the workspace id, which is a fresh randomUUID every time a
// workspace is opened (see project-state.ts). The root set is what's stable
// across sessions for "the same project", so re-opening a folder (or adding a
// repo to it) restores the right shared chat history.
function historyFile(workspaceKey: string): string {
  const hash = createHash("sha256").update(workspaceKey).digest("hex").slice(0, 16);
  return path.join(historyDir(), `${hash}.json`);
}

export async function loadChatHistory(workspaceKey: string): Promise<StoredChatMessage[]> {
  try {
    const raw = await fs.readFile(historyFile(workspaceKey), "utf-8");
    return JSON.parse(raw) as StoredChatMessage[];
  } catch {
    return []; // no saved session for this workspace yet
  }
}

export async function saveChatHistory(workspaceKey: string, messages: StoredChatMessage[]): Promise<void> {
  await fs.mkdir(historyDir(), { recursive: true });
  await fs.writeFile(historyFile(workspaceKey), JSON.stringify(messages, null, 2), "utf-8");
}

export async function clearChatHistory(workspaceKey: string): Promise<void> {
  try {
    await fs.unlink(historyFile(workspaceKey));
  } catch {
    // nothing to delete
  }
}