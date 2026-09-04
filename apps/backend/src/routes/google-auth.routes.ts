import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { buildGoogleConsentUrl, handleGoogleOAuthCallback } from "../modules/google-auth/google-oauth.service.js";
import { googleCredentialsRepository } from "../modules/google-auth/google-credentials.repository.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";

export const googleAuthRoutes = Router();

googleAuthRoutes.get("/auth-url", requireAuth, (req, res) => {
  res.json({ url: buildGoogleConsentUrl(req.userId!) });
});

googleAuthRoutes.get("/status", requireAuth, async (req, res) => {
  const status = await googleCredentialsRepository.getStatus(req.userId!);
  res.json(status);
});

googleAuthRoutes.post("/disconnect", requireAuth, async (req, res) => {
  await googleCredentialsRepository.disconnect(req.userId!);
  res.status(204).end();
});

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

googleAuthRoutes.get("/callback", async (req, res) => {
  const { code, state, error } = callbackQuerySchema.parse(req.query);

  if (error || !code) {
    return res.redirect(`${env.FRONTEND_BASE_URL}/integrations?google=error`);
  }

  try {
    await handleGoogleOAuthCallback(code, state);
    res.redirect(`${env.FRONTEND_BASE_URL}/integrations?google=connected`);
  } catch (err) {
    console.error("Google OAuth callback failed", err);
    res.redirect(`${env.FRONTEND_BASE_URL}/integrations?google=error`);
  }
});