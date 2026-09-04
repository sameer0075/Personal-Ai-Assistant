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
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  cc: z.string().email().optional(),
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

const linkedinDraftSchema = z.object({ commentary: z.string().min(1).max(3000) });

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
  to: z.string().email().optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  cc: z.string().email().optional(),
  attachCv: z.boolean().optional(),
  commentary: z.string().min(1).max(3000).optional(),
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