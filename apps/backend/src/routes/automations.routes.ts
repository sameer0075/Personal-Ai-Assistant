import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../modules/auth/auth.middleware.js";
import {
  createAutomation,
  deleteAutomation,
  listAutomations,
  runAutomationNow,
  updateAutomation,
} from "../modules/automations/automations.service.js";

export const automationsRoutes = Router();

automationsRoutes.use(requireAuth);

const scheduleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("once"),
    at: z.string().datetime({ offset: true }).describe("ISO datetime to fire at (must be in the future)"),
    timezone: z.string().trim().max(64).optional(),
  }),
  z.object({
    kind: z.literal("interval"),
    intervalMinutes: z.number().int().min(1).max(525_600),
    at: z.string().datetime({ offset: true }).optional().describe("Optional first-run datetime"),
    timezone: z.string().trim().max(64).optional(),
  }),
  z.object({
    kind: z.literal("cron"),
    cron: z.string().trim().min(1).max(60).describe("5-field cron expression, e.g. '0 9 * * 1-5'"),
    timezone: z.string().trim().max(64).optional(),
  }),
]);

const deliverySchema = z.object({
  mode: z.enum(["chat", "email", "both"]).default("chat"),
  emailTo: z.string().email().optional().describe("Optional override; defaults to the logged-in account's email"),
  emailSubject: z.string().trim().max(200).optional(),
});

const createAutomationSchema = z.object({
  title: z.string().trim().min(1, "Give the automation a title").max(120),
  prompt: z.string().trim().min(1, "The prompt can't be empty").max(2000),
  schedule: scheduleSchema,
  delivery: deliverySchema.optional(),
  deliverToSessionId: z.string().uuid().optional(),
});

const updateAutomationSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    prompt: z.string().trim().min(1).max(2000).optional(),
    schedule: scheduleSchema.optional(),
    delivery: deliverySchema.partial().optional(),
    deliverToSessionId: z.string().uuid().nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

/** GET /api/automations — the user's scheduled tasks, soonest trigger first. */
automationsRoutes.get("/", async (req, res) => {
  try {
    res.json(await listAutomations(req.userId!));
  } catch (err) {
    console.error("[automations] list failed:", err);
    res.status(500).json({ error: "Failed to load automations" });
  }
});

/** POST /api/automations — create a one-shot, interval, or cron automation. */
automationsRoutes.post("/", async (req, res) => {
  try {
    const parsed = createAutomationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid automation" });
      return;
    }
    const created = await createAutomation(req.userId!, parsed.data);
    res.status(201).json(created);
  } catch (err) {
    console.error("[automations] create failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create automation";
    res.status(400).json({ error: message });
  }
});

/** POST /api/automations/:id/run — run once immediately (results still land in chat). */
automationsRoutes.post("/:id/run", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Missing automation id" });
      return;
    }
    res.json(await runAutomationNow(req.userId!, id));
  } catch (err) {
    console.error(`[automations] run-now failed (${req.params.id}):`, err);
    const message = err instanceof Error ? err.message : "Failed to run automation";
    res.status(400).json({ error: message });
  }
});

/** PATCH /api/automations/:id — rename, re-prompt, reschedule, pause/resume. */
automationsRoutes.patch("/:id", async (req, res) => {
  try {
    const parsed = updateAutomationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid update" });
      return;
    }
    res.json(await updateAutomation(req.userId!, req.params.id, parsed.data));
  } catch (err) {
    console.error(`[automations] update failed (${req.params.id}):`, err);
    const message = err instanceof Error ? err.message : "Failed to update automation";
    res.status(400).json({ error: message });
  }
});

/** DELETE /api/automations/:id */
automationsRoutes.delete("/:id", async (req, res) => {
  try {
    await deleteAutomation(req.userId!, req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error(`[automations] delete failed (${req.params.id}):`, err);
    const message = err instanceof Error ? err.message : "Failed to delete automation";
    res.status(400).json({ error: message });
  }
});