import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { buildGoogleConsentUrl, handleGoogleOAuthCallback } from "../modules/google-auth/google-oauth.service.js";
import { googleCredentialsRepository } from "../modules/google-auth/google-credentials.repository.js";

export const googleAuthRoutes = Router();

/** GET /api/google/auth-url - frontend redirects the browser to this URL. */
googleAuthRoutes.get("/auth-url", (_req, res) => {
  res.json({ url: buildGoogleConsentUrl() });
});

/** GET /api/google/status - has the user connected a Google account? */
googleAuthRoutes.get("/status", async (_req, res) => {
  const status = await googleCredentialsRepository.getStatus();
  res.json(status);
});

/** POST /api/google/disconnect - revoke locally stored credentials. */
googleAuthRoutes.post("/disconnect", async (_req, res) => {
  await googleCredentialsRepository.disconnect();
  res.status(204).end();
});

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
});

/**
 * GET /api/google/callback - Google redirects here after consent.
 * We exchange the code server-side, then bounce the browser back to the
 * frontend with a simple success/error flag (never expose tokens in the URL).
 */
googleAuthRoutes.get("/callback", async (req, res) => {
  const { code, error } = callbackQuerySchema.parse(req.query);

  if (error || !code) {
    return res.redirect(`${env.FRONTEND_BASE_URL}/integrations?google=error`);
  }

  try {
    await handleGoogleOAuthCallback(code);
    res.redirect(`${env.FRONTEND_BASE_URL}/integrations?google=connected`);
  } catch (err) {
    console.error("Google OAuth callback failed", err);
    res.redirect(`${env.FRONTEND_BASE_URL}/integrations?google=error`);
  }
});