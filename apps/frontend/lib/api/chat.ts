import { API_BASE_URL, apiJson } from "./client";
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

/** Callbacks fired as SSE frames arrive from POST /chat/stream or /chat/edit/stream. */
export interface ChatStreamHandlers {
  onSession?: (sessionId: string) => void;
  onToken?: (content: string) => void;
  onToolStart?: (tool: string, input: unknown) => void;
  onToolEnd?: (tool: string, output?: string) => void;
  onComplete?: (data: AssistantAnswer) => void;
  onError?: (message: string) => void;
}

/**
 * Reads an SSE response body (`event: name\ndata: json\n\n` frames,
 * optionally interleaved with `: ping` heartbeat comments) and dispatches
 * each frame to the matching handler as soon as it arrives - this is what
 * lets the UI show tokens and tool activity live instead of waiting for the
 * whole agent turn to finish.
 */
async function consumeChatStream(res: Response, handlers: ChatStreamHandlers): Promise<void> {
  if (!res.body) throw new Error("Streaming is not supported in this environment");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let frameEnd: number;
    while ((frameEnd = buffer.indexOf("\n\n")) !== -1) {
      const rawFrame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 2);

      let eventName = "message";
      let dataLine = "";
      for (const line of rawFrame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue; // heartbeat comment or blank frame

      const payload = JSON.parse(dataLine);
      switch (eventName) {
        case "session":
          handlers.onSession?.(payload.sessionId);
          break;
        case "token":
          handlers.onToken?.(payload.content);
          break;
        case "tool_start":
          handlers.onToolStart?.(payload.tool, payload.input);
          break;
        case "tool_end":
          handlers.onToolEnd?.(payload.tool, payload.output);
          break;
        case "complete":
          handlers.onComplete?.(payload);
          break;
        case "error":
          handlers.onError?.(payload.message);
          break;
      }
    }
  }
}

async function postStream(path: string, body: unknown, handlers: ChatStreamHandlers, signal?: AbortSignal) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error ?? `Request failed with status ${res.status}`);
  }

  await consumeChatStream(res, handlers);
}

export function askQuestionStream(
  question: string,
  sessionId: string | undefined,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return postStream("/chat/stream", sessionId ? { question, sessionId } : { question }, handlers, signal);
}

export function editMessageStream(
  sessionId: string,
  messageId: string,
  question: string,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return postStream("/chat/edit/stream", { sessionId, messageId, question }, handlers, signal);
}