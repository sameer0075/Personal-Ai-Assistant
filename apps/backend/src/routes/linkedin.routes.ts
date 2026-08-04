import { Router } from "express";
import { z } from "zod";
import { callMcpTool } from "../modules/mcp/mcp-client.service.js";
import { syncLinkedinToRag } from "../modules/rag/ingest-external.service.js";

export const linkedinRoutes = Router();

const createPostSchema = z.object({
  commentary: z.string().min(1).max(3000),
  imageRef: z.string().optional(),
});

/** POST /api/linkedin/posts - Body: { commentary, imageRef? } - actually publishes to the user's LinkedIn profile. */
linkedinRoutes.post("/posts", async (req, res) => {
  try {
    const input = createPostSchema.parse(req.body);
    const json = await callMcpTool("linkedin_create_post", input);
    res.status(201).json(JSON.parse(json));
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to create post" });
  }
});

const listQuerySchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/linkedin/posts?maxResults=20
 * Reads from our own tracking table, not LinkedIn's API - see the migration
 * comment on `linkedin_posts` for why (r_member_social is restricted access).
 */
linkedinRoutes.get("/posts", async (req, res) => {
  try {
    const { maxResults } = listQuerySchema.parse(req.query);
    const json = await callMcpTool("linkedin_list_recent_posts", { maxResults });
    res.json(JSON.parse(json));
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to list posts" });
  }
});

/** DELETE /api/linkedin/posts/:urn (URL-encoded post URN) */
linkedinRoutes.delete("/posts/:urn", async (req, res) => {
  try {
    const postUrn = decodeURIComponent(req.params.urn);
    await callMcpTool("linkedin_delete_post", { postUrn });
    res.status(204).end();
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to delete post" });
  }
});

const syncSchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(50).default(20),
});

/** POST /api/linkedin/sync-to-rag - indexes recently-published posts into the vector store. */
linkedinRoutes.post("/sync-to-rag", async (req, res) => {
  try {
    const { maxResults } = syncSchema.parse(req.body);
    const summary = await syncLinkedinToRag({ maxResults });
    res.json(summary);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to sync LinkedIn to RAG" });
  }
});