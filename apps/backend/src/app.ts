import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { careersRoutes } from "./routes/careers.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Public career-site intake accepts any origin, so it's mounted before the
  // app-wide CORS policy that locks everything else to the frontend.
  app.use("/api/public/careers", careersRoutes);
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: "2mb" }));

  // Baseline hardening headers (a full CSP/helmet pass is overkill for an API-only
  // server; these close the cheap, high-value holes).
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    next();
  });

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api", apiRouter);

  // Centralised error handler - keeps route handlers free of try/catch boilerplate
  // for anything that slips through their own validation.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
