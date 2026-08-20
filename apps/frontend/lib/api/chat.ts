import { apiJson } from "./client";
import type { PendingAction } from "./actions";

export interface ToolCallTrace {
  tool: string;
  input: unknown;
  output?: string;
}

export interface AssistantAnswer {
  answer: string;
  toolCalls: ToolCallTrace[];
  pendingActions: PendingAction[];
}

export function askQuestion(question: string): Promise<AssistantAnswer> {
  return apiJson<AssistantAnswer>("/chat", "POST", { question });
}