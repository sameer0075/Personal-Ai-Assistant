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

// Keyed by project ROOT PATH, not projectId — projectId is a fresh
// randomUUID every time a project is opened (see project-state.ts), so
// keying by it would lose history the moment the app restarts. The root
// path is the one thing that's stable across sessions for "the same project".
function historyFile(projectRoot: string): string {
  const hash = createHash("sha256").update(projectRoot).digest("hex").slice(0, 16);
  return path.join(historyDir(), `${hash}.json`);
}

export async function loadChatHistory(projectRoot: string): Promise<StoredChatMessage[]> {
  try {
    const raw = await fs.readFile(historyFile(projectRoot), "utf-8");
    return JSON.parse(raw) as StoredChatMessage[];
  } catch {
    return []; // no saved session for this project yet
  }
}

export async function saveChatHistory(projectRoot: string, messages: StoredChatMessage[]): Promise<void> {
  await fs.mkdir(historyDir(), { recursive: true });
  await fs.writeFile(historyFile(projectRoot), JSON.stringify(messages, null, 2), "utf-8");
}

export async function clearChatHistory(projectRoot: string): Promise<void> {
  try {
    await fs.unlink(historyFile(projectRoot));
  } catch {
    // nothing to delete
  }
}