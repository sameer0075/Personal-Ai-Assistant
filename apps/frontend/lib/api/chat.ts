import { apiJson } from "./client";

export interface ToolCallTrace {
  tool: string;
  input: unknown;
  output?: string;
}

export interface AssistantAnswer {
  answer: string;
  toolCalls: ToolCallTrace[];
}

export function askQuestion(question: string): Promise<AssistantAnswer> {
  return apiJson<AssistantAnswer>("/chat", "POST", { question });
}