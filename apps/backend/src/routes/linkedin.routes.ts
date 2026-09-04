import { Router } from "express";
import { z } from "zod";
import { callMcpTool } from "../modules/mcp/mcp-client.service.js";
import { syncLinkedinToRag } from "../modules/rag/ingest-external.service.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";

export const linkedinRoutes = Router();
linkedinRoutes.use(requireAuth);

const createPostSchema = z.object({
  commentary: z.string().min(1).max(3000),
  imageRef: z.string().optional(),
});

/** POST /api/linkedin/posts - Body: { commentary, imageRef? } - publishes to the user's LinkedIn profile. */
linkedinRoutes.post("/posts", async (req, res) => {
  try {
    const input = createPostSchema.parse(req.body);
    const json = await callMcpTool("linkedin_create_post", { ...input, userId: req.userId! });
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
 * Reads from our own tracking table, scoped to the authenticated user.
 */
linkedinRoutes.get("/posts", async (req, res) => {
  try {
    const { maxResults } = listQuerySchema.parse(req.query);
    const json = await callMcpTool("linkedin_list_recent_posts", { maxResults, userId: req.userId! });
    res.json(JSON.parse(json));
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to list posts" });
  }
});

/** DELETE /api/linkedin/posts/:urn (URL-encoded post URN) */
linkedinRoutes.delete("/posts/:urn", async (req, res) => {
  try {
    const postUrn = decodeURIComponent(req.params.urn);
    await callMcpTool("linkedin_delete_post", { postUrn, userId: req.userId! });
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
    const summary = await syncLinkedinToRag(req.userId!, { maxResults });
    res.json(summary);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to sync LinkedIn to RAG" });
  }
});