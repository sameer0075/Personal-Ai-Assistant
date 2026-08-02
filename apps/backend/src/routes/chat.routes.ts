import { Router } from "express";
import { z } from "zod";
import { runAssistantAgent } from "../modules/agent/assistant-agent.graph.js";

export const chatRoutes = Router();

const chatRequestSchema = z.object({
  question: z.string().min(1, "question is required"),
});

/**
 * POST /api/chat
 * Body: { "question": "Email John a summary of the roadmap doc and put a follow-up on my calendar for Friday" }
 *
 * Backed by the tool-calling agent (assistant-agent.graph.ts): it decides on
 * its own whether to search the knowledge base, read/send Gmail, and/or
 * manage Calendar events to answer - this single endpoint now covers Module 1
 * (CV RAG) and Module 2 (Gmail + Calendar) together.
 */
chatRoutes.post("/", async (req, res) => {
  try {
    const { question } = chatRequestSchema.parse(req.body);
    const result = await runAssistantAgent(question);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(422).json({ error: message });
  }
});