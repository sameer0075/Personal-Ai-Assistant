import { Router } from "express";
import { z } from "zod";
import {
  listPendingActions,
  createEmailDraft,
  createLinkedinDraft,
  approvePendingAction,
  rejectPendingAction,
} from "../modules/actions/pending-actions.service.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";

export const actionsRoutes = Router();
actionsRoutes.use(requireAuth);

actionsRoutes.get("/pending", async (req, res) => {
  res.json(await listPendingActions(req.userId!));
});

const emailDraftSchema = z.object({
  to: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(500, "Subject is too long (max 500 characters)"),
  body: z.string().trim().min(1).max(200_000, "Body is too long (max 200,000 characters)"),
  cc: z.string().trim().email().max(254).optional(),
  attachCv: z.boolean().optional(),
});

actionsRoutes.post("/email/draft", async (req, res) => {
  try {
    const payload = emailDraftSchema.parse(req.body);
    const action = await createEmailDraft(req.userId!, payload, "user");
    res.status(201).json(action);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to draft email" });
  }
});

const linkedinDraftSchema = z.object({ commentary: z.string().trim().min(1).max(3000) });

actionsRoutes.post("/linkedin/draft", async (req, res) => {
  try {
    const payload = linkedinDraftSchema.parse(req.body);
    const action = await createLinkedinDraft(req.userId!, payload, "user");
    res.status(201).json(action);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to draft post" });
  }
});

const approveSchema = z.object({
  to: z.string().trim().email().max(254).optional(),
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).max(200_000).optional(),
  cc: z.string().trim().email().max(254).optional(),
  attachCv: z.boolean().optional(),
  commentary: z.string().trim().min(1).max(3000).optional(),
});

actionsRoutes.post("/:id/approve", async (req, res) => {
  try {
    const edits = approveSchema.parse(req.body ?? {});
    const action = await approvePendingAction(req.params.id, req.userId!, edits);
    res.json(action);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to approve action" });
  }
});

actionsRoutes.post("/:id/reject", async (req, res) => {
  try {
    const action = await rejectPendingAction(req.params.id, req.userId!);
    res.json(action);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to reject action" });
  }
});