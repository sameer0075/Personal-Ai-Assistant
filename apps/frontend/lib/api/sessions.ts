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

// NOTE: guessing apiJson supports a DELETE verb with no body, the same way
// it takes POST elsewhere (e.g. actions.ts). If that's wrong, or client.ts
// has a dedicated apiDelete, swap this for whatever it actually exposes.
export async function deleteSession(sessionId: string): Promise<void> {
  await apiJson(`/sessions/${sessionId}`, "DELETE");
}