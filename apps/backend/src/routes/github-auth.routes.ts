import { Router } from "express";
import { z } from "zod";
import { connectGithub, disconnectGithub, getGithubStatus, syncGithub } from "../modules/github-auth/github-auth.service.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";

export const githubRoutes = Router();

const connectSchema = z.object({
  token: z.string().min(20, "Please paste a personal access token."),
});

/** POST /api/github/connect - validate + store a PAT (encrypted) for the current user. */
githubRoutes.post("/connect", requireAuth, async (req, res) => {
  try {
    const { token } = connectSchema.parse(req.body);
    const status = await connectGithub(req.userId!, token);
    res.json(status);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to connect GitHub" });
  }
});

/** GET /api/github - has the current user connected a GitHub account? */
githubRoutes.get("/", requireAuth, async (req, res) => {
  try {
    res.json(await getGithubStatus(req.userId!));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load GitHub status" });
  }
});

/** POST /api/github/sync - index the user's open issues into search. */
githubRoutes.post("/sync", requireAuth, async (req, res) => {
  try {
    const result = await syncGithub(req.userId!);
    res.json(result);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to sync GitHub" });
  }
});

/** DELETE /api/github - revoke locally stored GitHub credentials. */
githubRoutes.delete("/", requireAuth, async (req, res) => {
  try {
    await disconnectGithub(req.userId!);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to disconnect GitHub" });
  }
});