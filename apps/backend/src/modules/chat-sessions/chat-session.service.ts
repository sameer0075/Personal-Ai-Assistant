import { chatSessionRepository } from "./chat-session.repository.js";
import { ingestText } from "../rag/ingest-text.service.js";
import type { AssistantAnswer, ChatSession, ChatMessageRecord } from "../../types/index.js";

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

export async function getOrCreateSession(sessionId?: string): Promise<ChatSession> {
  if (sessionId) {
    const existing = await chatSessionRepository.getSession(sessionId);
    if (existing) return existing;
  }
  return chatSessionRepository.createSession();
}

export async function getHistoryForAgent(
  sessionId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const rows = await chatSessionRepository.getRecentMessages(sessionId, HISTORY_WINDOW);
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

/**
 * Persists both sides of a turn, sets the session's sidebar title from the
 * first user message if it's still the default, and returns the new row ids
 * so the frontend can attach them to messages for future edits.
 */
export async function recordTurn(
  sessionId: string,
  question: string,
  result: AssistantAnswer
): Promise<{ userMessageId: string; assistantMessageId: string }> {
  const userMessage = await chatSessionRepository.appendMessage({ sessionId, role: "user", content: question });
  const assistantMessage = await chatSessionRepository.appendMessage({
    sessionId,
    role: "assistant",
    content: result.answer,
    toolCalls: result.toolCalls,
    pendingActionIds: result.pendingActions.map((a) => a.id),
  });
  await chatSessionRepository.setTitleIfDefault(sessionId, question.slice(0, 48));
  return { userMessageId: userMessage.id, assistantMessageId: assistantMessage.id };
}

/**
 * NEW - edit support. Validates the message belongs to this session and is
 * a user message, then deletes it and everything after it (its old reply
 * included). The caller then runs a normal turn with the edited question,
 * exactly like a brand-new message - this function only does the cut.
 */
export async function editUserMessage(sessionId: string, messageId: string): Promise<void> {
  const message = await chatSessionRepository.getMessage(messageId);
  if (!message || message.sessionId !== sessionId) {
    throw new Error("Message not found in this session");
  }
  if (message.role !== "user") {
    throw new Error("Only your own messages can be edited");
  }
  await chatSessionRepository.deleteMessagesFrom(sessionId, message.createdAt);
}

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