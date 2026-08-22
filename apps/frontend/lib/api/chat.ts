import { apiJson } from "./client";
import type { PendingAction } from "./actions";

export interface ToolCallTrace {
  tool: string;
  input: unknown;
  output?: string;
}

export interface AssistantAnswer {
  sessionId: string;
  userMessageId: string;
  assistantMessageId: string;
  answer: string;
  toolCalls: ToolCallTrace[];
  pendingActions: PendingAction[];
}

export function askQuestion(question: string, sessionId?: string): Promise<AssistantAnswer> {
  return apiJson<AssistantAnswer>("/chat", "POST", sessionId ? { question, sessionId } : { question });
}

export function editMessage(sessionId: string, messageId: string, question: string): Promise<AssistantAnswer> {
  return apiJson<AssistantAnswer>("/chat/edit", "POST", { sessionId, messageId, question });
}