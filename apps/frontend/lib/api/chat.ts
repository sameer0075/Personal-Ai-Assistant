import { API_BASE_URL, apiFetch, apiJson } from "./client";
import { getToken, clearToken } from "../auth/token";
import type { PendingAction } from "./actions";

export interface ToolCallTrace {
  tool: string;
  input: unknown;
  output?: string;
}

/**
 * A file attached directly to a chat message. Separate from the persistent
 * document library (see ./documents' uploadCv) - this rides along with one
 * message so the agent can answer questions about it, but it's never pushed
 * into the RAG index or made searchable from other chats.
 */
export interface ChatAttachment {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  truncated: boolean;
}

export interface AssistantAnswer {
  sessionId: string;
  userMessageId: string;
  assistantMessageId: string;
  answer: string;
  toolCalls: ToolCallTrace[];
  pendingActions: PendingAction[];
}

/** Builds either a JSON body or (when a file is attached) multipart form data for a chat request. */
function buildChatBody(fields: Record<string, string | undefined>, file?: File): { body: BodyInit; headers?: Record<string, string> } {
  if (file) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) formData.append(key, value);
    }
    formData.append("file", file);
    return { body: formData }; // no Content-Type - fetch sets the multipart boundary itself
  }
  return { body: JSON.stringify(fields), headers: { "Content-Type": "application/json" } };
}

/**
 * Sends a chat turn. Passing `file` attaches it to THIS message only - the
 * agent reads its text directly to answer questions about it, but it is
 * never written to the persistent document library (see uploadCv in
 * ./documents for that, a separate, explicit action).
 */
export function askQuestion(question: string, sessionId?: string, file?: File): Promise<AssistantAnswer> {
  if (file) {
    const { body } = buildChatBody({ question, sessionId }, file);
    return apiFetch<AssistantAnswer>("/chat", { method: "POST", body });
  }
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

async function postStream(
  path: string,
  fields: Record<string, string | undefined>,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
  file?: File
) {
  const { body, headers: bodyHeaders } = buildChatBody(fields, file);
  const token = getToken();
  const headers = new Headers(bodyHeaders);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body,
    signal,
  });

  if (res.status === 401 && token) {
    clearToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error ?? `Request failed with status ${res.status}`);
  }

  await consumeChatStream(res, handlers);
}

/**
 * Streaming chat turn. Passing `file` attaches it to THIS message only - see
 * the non-streaming askQuestion above for the same note on scope.
 */
export function askQuestionStream(
  question: string,
  sessionId: string | undefined,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
  file?: File
): Promise<void> {
  return postStream("/chat/stream", { question, sessionId }, handlers, signal, file);
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