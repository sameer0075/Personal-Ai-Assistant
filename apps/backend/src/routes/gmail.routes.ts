import { Router } from "express";
import { z } from "zod";
import { callMcpTool } from "../modules/mcp/mcp-client.service.js";
import { syncGmailToRag } from "../modules/rag/ingest-external.service.js";

export const gmailRoutes = Router();

const listQuerySchema = z.object({
  query: z.string().optional(),
  maxResults: z.coerce.number().int().min(1).max(50).default(20),
});

/** GET /api/gmail/messages?query=...&maxResults=20 */
gmailRoutes.get("/messages", async (req, res) => {
  try {
    const { query, maxResults } = listQuerySchema.parse(req.query);
    const json = await callMcpTool("gmail_list_messages", { query, maxResults });
    res.json(JSON.parse(json));
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to list messages" });
  }
});

/** GET /api/gmail/messages/:id */
gmailRoutes.get("/messages/:id", async (req, res) => {
  try {
    const json = await callMcpTool("gmail_get_message", { messageId: req.params.id });
    res.json(JSON.parse(json));
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to fetch message" });
  }
});

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  cc: z.string().email().optional(),
});

/** POST /api/gmail/send - Body: { to, subject, body, cc? } */
gmailRoutes.post("/send", async (req, res) => {
  try {
    const input = sendSchema.parse(req.body);
    const json = await callMcpTool("gmail_send_message", input);
    res.status(201).json(JSON.parse(json));
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to send message" });
  }
});

const syncSchema = z.object({
  query: z.string().optional(),
  maxResults: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * POST /api/gmail/sync-to-rag - Body: { query?, maxResults? }
 * Indexes recent messages into the vector store so the chat agent's
 * search_knowledge_base tool can recall them later without re-fetching Gmail.
 */
gmailRoutes.post("/sync-to-rag", async (req, res) => {
  try {
    const input = syncSchema.parse(req.body);
    const summary = await syncGmailToRag(input);
    res.json(summary);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to sync Gmail to RAG" });
  }
});