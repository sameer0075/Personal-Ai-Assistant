import { Router } from "express";
import { z } from "zod";
import { runAssistantAgent } from "../modules/agent/assistant-agent.graph.js";
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