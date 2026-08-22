import { apiFetch, apiJson } from "./client";
import type { ToolCallTrace } from "./chat";
import type { PendingAction } from "./actions";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCallTrace[];
  pendingActions: PendingAction[];
}

export function listSessions(): Promise<ChatSession[]> {
  return apiFetch<ChatSession[]>("/sessions");
}

export function getSessionMessages(sessionId: string): Promise<StoredMessage[]> {
  return apiFetch<StoredMessage[]>(`/sessions/${sessionId}/messages`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiJson(`/sessions/${sessionId}`, "DELETE");
}