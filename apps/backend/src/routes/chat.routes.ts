import { Router } from "express";
import { z } from "zod";
import { runAssistantAgent } from "../modules/agent/assistant-agent.graph.js";
import {
  getOrCreateSession,
  getHistoryForAgent,
  recordTurn,
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

    await recordTurn(session.id, question, result);
    indexTurnForRecall(session.id, question, result.answer);

    res.json({ sessionId: session.id, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(422).json({ error: message });
  }
});