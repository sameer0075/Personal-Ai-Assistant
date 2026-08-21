import { apiJson } from "./client";
import type { PendingAction } from "./actions";

export interface ToolCallTrace {
  tool: string;
  input: unknown;
  output?: string;
}

export interface AssistantAnswer {
  sessionId: string;
  answer: string;
  toolCalls: ToolCallTrace[];
  pendingActions: PendingAction[];
}

/** Pass sessionId to continue an existing chat; omit it to start a new one. */
export function askQuestion(question: string, sessionId?: string): Promise<AssistantAnswer> {
  return apiJson<AssistantAnswer>("/chat", "POST", sessionId ? { question, sessionId } : { question });
}