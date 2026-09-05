import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../modules/auth/auth.middleware.js";
import { unifiedSearch, type UnifiedSearchOptions } from "../modules/search/search.service.js";

export const searchRoutes = Router();

searchRoutes.use(requireAuth);

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Enter something to search for").max(200, "Search query is too long"),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * GET /api/search?q=…&limit=…
 *
 * One query across chat history, documents, and synced emails/events/posts.
 * Returns grouped hits (each group capped at `limit`, default 8) plus the
 * single strongest group front-loaded as `highlight`. Semantic matching runs
 * against the same pgvector index the agent's RAG search uses.
 */
searchRoutes.get("/", async (req, res) => {
  try {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid search parameters" });
      return;
    }

    const options: UnifiedSearchOptions = parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {};
    res.json(await unifiedSearch(req.userId!, parsed.data.q, options));
  } catch (err) {
    console.error("[search] unable to run unified search:", err);
    res.status(500).json({ error: "Search failed" });
  }
});