import { chatSessionRepository } from "./chat-session.repository.js";
import { ingestText } from "../rag/ingest-text.service.js";
import type { AssistantAnswer, ChatSession, ChatMessageRecord } from "../../types/index.js";

/** Number of raw prior messages passed to the agent for same-session continuity. */
export const HISTORY_WINDOW = 10;

export function listSessions(): Promise<ChatSession[]> {
  return chatSessionRepository.listSessions();
}

export function getAllMessages(sessionId: string): Promise<ChatMessageRecord[]> {
  return chatSessionRepository.getAllMessages(sessionId);
}

export function deleteSession(sessionId: string): Promise<void> {
  return chatSessionRepository.deleteSession(sessionId);
}

/** If sessionId is given and exists, returns it; otherwise creates a fresh session. */
export async function getOrCreateSession(sessionId?: string): Promise<ChatSession> {
  if (sessionId) {
    const existing = await chatSessionRepository.getSession(sessionId);
    if (existing) return existing;
  }
  return chatSessionRepository.createSession();
}

/** The last HISTORY_WINDOW messages, in {role, content} shape ready to feed into the agent. */
export async function getHistoryForAgent(
  sessionId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const rows = await chatSessionRepository.getRecentMessages(sessionId, HISTORY_WINDOW);
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

/**
 * Persists both sides of a turn, and sets the session's sidebar title from
 * the first user message if it's still the default.
 */
export async function recordTurn(sessionId: string, question: string, result: AssistantAnswer): Promise<void> {
  await chatSessionRepository.appendMessage({ sessionId, role: "user", content: question });
  await chatSessionRepository.appendMessage({
    sessionId,
    role: "assistant",
    content: result.answer,
    toolCalls: result.toolCalls,
    pendingActionIds: result.pendingActions.map((a) => a.id),
  });
  await chatSessionRepository.setTitleIfDefault(sessionId, question.slice(0, 48));
}

/**
 * Indexes this turn into the same document_chunks table CV/Gmail/Calendar/
 * LinkedIn already use, tagged sourceType "conversation" - this is what lets
 * a *different* session's search_knowledge_base call surface it later.
 * Deliberately fire-and-forget: a failed embed shouldn't block the chat
 * response, and doing this after responding keeps per-turn latency down.
 */
export function indexTurnForRecall(sessionId: string, question: string, answer: string): void {
  ingestText({
    title: question.slice(0, 60),
    text: `User asked: ${question}\n\nAssistant answered: ${answer}`,
    sourceType: "conversation",
    metadata: { sessionId },
  }).catch((err) => {
    console.error(`Failed to index conversation turn for recall (session ${sessionId}):`, err);
  });
}