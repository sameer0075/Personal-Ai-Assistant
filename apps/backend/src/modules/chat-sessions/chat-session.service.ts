import { chatSessionRepository } from "./chat-session.repository.js";
import { ingestText } from "../rag/ingest-text.service.js";
import { formatContentForAgent } from "./attachment-format.js";
import type { AssistantAnswer, ChatSession, ChatMessageRecord, ChatAttachment } from "../../types/index.js";

export const HISTORY_WINDOW = 10;

export function listSessions(userId: string): Promise<ChatSession[]> {
  return chatSessionRepository.listSessions(userId);
}

export async function getAllMessages(sessionId: string, userId: string): Promise<ChatMessageRecord[]> {
  const session = await chatSessionRepository.getSession(sessionId, userId);
  if (!session) throw new Error("Chat not found");
  return chatSessionRepository.getAllMessages(sessionId);
}

export function deleteSession(sessionId: string, userId: string): Promise<void> {
  return chatSessionRepository.deleteSession(sessionId, userId);
}

export async function getOrCreateSession(userId: string, sessionId?: string): Promise<ChatSession> {
  if (sessionId) {
    const existing = await chatSessionRepository.getSession(sessionId, userId);
    if (!existing) throw new Error("Chat not found");
    return existing;
  }
  return chatSessionRepository.createSession(userId);
}

export async function getHistoryForAgent(
  sessionId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const rows = await chatSessionRepository.getRecentMessages(sessionId, HISTORY_WINDOW);
  return rows.map((r) => ({ role: r.role, content: formatContentForAgent(r.content, r.attachments) }));
}

export async function recordTurn(
  sessionId: string,
  question: string,
  result: AssistantAnswer,
  attachments?: ChatAttachment[]
): Promise<{ userMessageId: string; assistantMessageId: string }> {
  const userMessage = await chatSessionRepository.appendMessage({ sessionId, role: "user", content: question, attachments });
  const assistantMessage = await chatSessionRepository.appendMessage({
    sessionId, role: "assistant", content: result.answer, toolCalls: result.toolCalls,
    pendingActionIds: result.pendingActions.map((a) => a.id),
  });
  await chatSessionRepository.setTitleIfDefault(sessionId, question.slice(0, 48));
  return { userMessageId: userMessage.id, assistantMessageId: assistantMessage.id };
}

export async function editUserMessage(sessionId: string, userId: string, messageId: string): Promise<void> {
  const session = await chatSessionRepository.getSession(sessionId, userId);
  if (!session) throw new Error("Chat not found");

  const message = await chatSessionRepository.getMessage(messageId);
  if (!message || message.sessionId !== sessionId) throw new Error("Message not found in this session");
  if (message.role !== "user") throw new Error("Only your own messages can be edited");
  await chatSessionRepository.deleteMessagesFrom(sessionId, message.createdAt);
}

export function indexTurnForRecall(userId: string, sessionId: string, question: string, answer: string): void {
  ingestText({
    userId,
    title: question.slice(0, 60),
    text: `User asked: ${question}\n\nAssistant answered: ${answer}`,
    sourceType: "conversation",
    metadata: { sessionId },
  }).catch((err) => {
    console.error(`Failed to index conversation turn for recall (session ${sessionId}):`, err);
  });
}