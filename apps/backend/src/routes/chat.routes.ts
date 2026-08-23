import { Router, type Response } from "express";
import { z } from "zod";
import { runAssistantAgent, streamAssistantAgent } from "../modules/agent/assistant-agent.graph.js";
import {
  getOrCreateSession,
  getHistoryForAgent,
  recordTurn,
  editUserMessage,
  indexTurnForRecall,
} from "../modules/chat-sessions/chat-session.service.js";

export const chatRoutes = Router();

const chatRequestSchema = z.object({
  question: z.string().min(1, "question is required"),
  sessionId: z.string().uuid().optional(),
});

/** Small SSE helper: one `event: <name>\ndata: <json>\n\n` frame per call. */
function sendEvent(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Runs the agent against `question`/`history`, streaming tokens and tool
 * activity to the client as SSE frames as soon as they happen, then persists
 * the turn (same as the non-streaming route) once the agent is done and
 * emits a final "complete" frame carrying the same payload shape the old
 * JSON response used, so the frontend can finalize the message in one place.
 */
async function streamTurn(res: Response, sessionId: string, question: string): Promise<void> {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx response buffering, if present
  res.flushHeaders();

  // Heartbeat so idle proxies/load balancers don't kill the connection while
  // the agent is mid tool-call (e.g. waiting on a slow MCP server).
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
  res.on("close", () => clearInterval(heartbeat));

  sendEvent(res, "session", { sessionId });

  try {
    const history = await getHistoryForAgent(sessionId);

    for await (const event of streamAssistantAgent(question, history)) {
      if (event.type === "token") {
        sendEvent(res, "token", { content: event.content });
      } else if (event.type === "tool_start") {
        sendEvent(res, "tool_start", { tool: event.tool, input: event.input });
      } else if (event.type === "tool_end") {
        sendEvent(res, "tool_end", { tool: event.tool, output: event.output });
      } else if (event.type === "error") {
        sendEvent(res, "error", { message: event.message });
      } else if (event.type === "done") {
        const { userMessageId, assistantMessageId } = await recordTurn(sessionId, question, event.data);
        indexTurnForRecall(sessionId, question, event.data.answer);
        sendEvent(res, "complete", { sessionId, userMessageId, assistantMessageId, ...event.data });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    sendEvent(res, "error", { message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

chatRoutes.post("/", async (req, res) => {
  try {
    const { question, sessionId: requestedSessionId } = chatRequestSchema.parse(req.body);
    const session = await getOrCreateSession(requestedSessionId);

    const history = await getHistoryForAgent(session.id);
    const result = await runAssistantAgent(question, history);

    const { userMessageId, assistantMessageId } = await recordTurn(session.id, question, result);
    indexTurnForRecall(session.id, question, result.answer);

    res.json({ sessionId: session.id, userMessageId, assistantMessageId, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(422).json({ error: message });
  }
});

/**
 * POST /api/chat/stream - SSE version of POST /api/chat. Same validation and
 * persistence as the JSON route; the only difference is the response is a
 * live event stream (session -> token* / tool_start* / tool_end* -> complete)
 * instead of one big JSON blob at the end.
 */
chatRoutes.post("/stream", async (req, res) => {
  let parsed: { question: string; sessionId?: string };
  try {
    parsed = chatRequestSchema.parse(req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(422).json({ error: message });
    return;
  }

  const session = await getOrCreateSession(parsed.sessionId);
  await streamTurn(res, session.id, parsed.question);
});

const editRequestSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  question: z.string().min(1, "question is required"),
});

/**
 * POST /api/chat/edit
 * Deletes `messageId` (must be your own message in that session) and
 * everything after it - including its old reply - then runs a fresh turn
 * with the edited question. Same response shape as POST /api/chat.
 */
chatRoutes.post("/edit", async (req, res) => {
  try {
    const { sessionId, messageId, question } = editRequestSchema.parse(req.body);

    await editUserMessage(sessionId, messageId);

    const history = await getHistoryForAgent(sessionId);
    const result = await runAssistantAgent(question, history);

    const { userMessageId, assistantMessageId } = await recordTurn(sessionId, question, result);
    indexTurnForRecall(sessionId, question, result.answer);

    res.json({ sessionId, userMessageId, assistantMessageId, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(422).json({ error: message });
  }
});

/** POST /api/chat/edit/stream - SSE version of POST /api/chat/edit. */
chatRoutes.post("/edit/stream", async (req, res) => {
  let parsed: { sessionId: string; messageId: string; question: string };
  try {
    parsed = editRequestSchema.parse(req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(422).json({ error: message });
    return;
  }

  try {
    await editUserMessage(parsed.sessionId, parsed.messageId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(422).json({ error: message });
    return;
  }

  await streamTurn(res, parsed.sessionId, parsed.question);
});