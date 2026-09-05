import { Router } from "express";
import { requireAuth } from "../modules/auth/auth.middleware.js";
import { getAgentRosterSummary } from "../modules/agent/supervisor.agent.js";

export const agentsRoutes = Router();

/** GET /api/agents - the live agent roster (supervisor + specialists + tools). */
agentsRoutes.get("/", requireAuth, async (_req, res) => {
  try {
    res.json(await getAgentRosterSummary());
  } catch (err) {
    console.error("[agents] failed to load roster:", err);
    res.status(500).json({ error: "Failed to load agent roster" });
  }
});