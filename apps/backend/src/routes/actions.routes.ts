import { Router } from "express";
import { z } from "zod";
import {
  listPendingActions,
  createEmailDraft,
  createLinkedinDraft,
  approvePendingAction,
  rejectPendingAction,
} from "../modules/actions/pending-actions.service.js";

export const actionsRoutes = Router();

actionsRoutes.get("/pending", async (_req, res) => {
  res.json(await listPendingActions());
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
    const action = await createEmailDraft(payload, "user");
    res.status(201).json(action);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to draft email" });
  }
});

const linkedinDraftSchema = z.object({
  commentary: z.string().min(1).max(3000),
});

actionsRoutes.post("/linkedin/draft", async (req, res) => {
  try {
    const payload = linkedinDraftSchema.parse(req.body);
    const action = await createLinkedinDraft(payload, "user");
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
    const action = await approvePendingAction(req.params.id, edits);
    res.json(action);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to approve action" });
  }
});

actionsRoutes.post("/:id/reject", async (req, res) => {
  try {
    const action = await rejectPendingAction(req.params.id);
    res.json(action);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to reject action" });
  }
});