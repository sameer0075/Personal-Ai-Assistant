import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { buildLinkedinConsentUrl, handleLinkedinOAuthCallback } from "../modules/linkedin-auth/linkedin-oauth.service.js";
import { linkedinCredentialsRepository } from "../modules/linkedin-auth/linkedin-credentials.repository.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";

export const linkedinAuthRoutes = Router();

/** GET /api/linkedin/auth-url - returns OAuth consent URL with signed userId state. */
linkedinAuthRoutes.get("/auth-url", requireAuth, (req, res) => {
  res.json({ url: buildLinkedinConsentUrl(req.userId!) });
});

/** GET /api/linkedin/status - has the current user connected a LinkedIn account? */
linkedinAuthRoutes.get("/status", requireAuth, async (req, res) => {
  res.json(await linkedinCredentialsRepository.getStatus(req.userId!));
});

/** POST /api/linkedin/disconnect - revoke locally stored credentials for the current user. */
linkedinAuthRoutes.post("/disconnect", requireAuth, async (req, res) => {
  await linkedinCredentialsRepository.disconnect(req.userId!);
  res.status(204).end();
});

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

/** GET /api/linkedin/callback - LinkedIn redirects here after consent. */
linkedinAuthRoutes.get("/callback", async (req, res) => {
  const { code, state, error } = callbackQuerySchema.parse(req.query);

  if (error || !code) {
    return res.redirect(`${env.FRONTEND_BASE_URL}/integrations?linkedin=error`);
  }

  try {
    await handleLinkedinOAuthCallback(code, state);
    res.redirect(`${env.FRONTEND_BASE_URL}/integrations?linkedin=connected`);
  } catch (err) {
    console.error("LinkedIn OAuth callback failed", err);
    res.redirect(`${env.FRONTEND_BASE_URL}/integrations?linkedin=error`);
  }
});