import { Router } from "express";
import { z } from "zod";
import { callMcpTool } from "../modules/mcp/mcp-client.service.js";
import { syncCalendarToRag } from "../modules/rag/ingest-external.service.js";

export const calendarRoutes = Router();

const listQuerySchema = z.object({
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
  maxResults: z.coerce.number().int().min(1).max(50).default(25),
});

/** GET /api/calendar/events?timeMin=...&timeMax=...&maxResults=25 (ISO8601 datetimes) */
calendarRoutes.get("/events", async (req, res) => {
  try {
    const { timeMin, timeMax, maxResults } = listQuerySchema.parse(req.query);
    const json = await callMcpTool("calendar_list_events", { timeMin, timeMax, maxResults });
    res.json(JSON.parse(json));
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to list events" });
  }
});

const createEventSchema = z.object({
  summary: z.string().min(1),
  description: z.string().optional(),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime(),
  timeZone: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

/** POST /api/calendar/events - Body: { summary, description?, startDateTime, endDateTime, timeZone?, attendees? } */
calendarRoutes.post("/events", async (req, res) => {
  try {
    const input = createEventSchema.parse(req.body);
    const json = await callMcpTool("calendar_create_event", input);
    res.status(201).json(JSON.parse(json));
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to create event" });
  }
});

/** DELETE /api/calendar/events/:id */
calendarRoutes.delete("/events/:id", async (req, res) => {
  try {
    await callMcpTool("calendar_delete_event", { eventId: req.params.id });
    res.status(204).end();
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to delete event" });
  }
});

const syncSchema = z.object({
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
  maxResults: z.coerce.number().int().min(1).max(50).default(25),
});

/** POST /api/calendar/sync-to-rag - indexes upcoming events into the vector store. */
calendarRoutes.post("/sync-to-rag", async (req, res) => {
  try {
    const input = syncSchema.parse(req.body);
    const summary = await syncCalendarToRag(input);
    res.json(summary);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to sync Calendar to RAG" });
  }
});