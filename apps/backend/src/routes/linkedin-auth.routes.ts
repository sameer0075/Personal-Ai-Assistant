import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { buildLinkedinConsentUrl, handleLinkedinOAuthCallback } from "../modules/linkedin-auth/linkedin-oauth.service.js";
import { linkedinCredentialsRepository } from "../modules/linkedin-auth/linkedin-credentials.repository.js";

export const linkedinAuthRoutes = Router();

/** GET /api/linkedin/auth-url - frontend redirects the browser to this URL. */
linkedinAuthRoutes.get("/auth-url", (_req, res) => {
  res.json({ url: buildLinkedinConsentUrl() });
});

/** GET /api/linkedin/status - has the user connected a LinkedIn account? */
linkedinAuthRoutes.get("/status", async (_req, res) => {
  res.json(await linkedinCredentialsRepository.getStatus());
});

/** POST /api/linkedin/disconnect - revoke locally stored credentials. */
linkedinAuthRoutes.post("/disconnect", async (_req, res) => {
  await linkedinCredentialsRepository.disconnect();
  res.status(204).end();
});

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
});

/** GET /api/linkedin/callback - LinkedIn redirects here after consent. */
linkedinAuthRoutes.get("/callback", async (req, res) => {
  const { code, error } = callbackQuerySchema.parse(req.query);

  if (error || !code) {
    return res.redirect(`${env.FRONTEND_BASE_URL}/integrations?linkedin=error`);
  }

  try {
    await handleLinkedinOAuthCallback(code);
    res.redirect(`${env.FRONTEND_BASE_URL}/integrations?linkedin=connected`);
  } catch (err) {
    console.error("LinkedIn OAuth callback failed", err);
    res.redirect(`${env.FRONTEND_BASE_URL}/integrations?linkedin=error`);
  }
});