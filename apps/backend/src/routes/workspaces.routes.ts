import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../modules/auth/auth.middleware.js";
import { listWorkspaces } from "../modules/workspaces/workspace.service.js";
import { createDepartment, deleteDepartment, updateDepartment } from "../modules/workspaces/workspace.service.js";

export const workspacesRoutes = Router();
workspacesRoutes.use(requireAuth);
workspacesRoutes.get("/", async (req, res) => {
  res.json(await listWorkspaces(req.userId!));
});

workspacesRoutes.post("/departments", async (req, res) => {
  try {
    const { name, parentId } = z.object({ name: z.string().trim().min(1).max(80), parentId: z.string().uuid().nullable().optional() }).parse(req.body);
    res.status(201).json(await createDepartment(req.userId!, req.workspaceId!, name, parentId ?? null));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create department" });
  }
});

workspacesRoutes.patch("/departments/:id", async (req, res) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    await updateDepartment(req.userId!, req.workspaceId!, req.params.id, name);
    res.json({ updated: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update department" });
  }
});

workspacesRoutes.delete("/departments/:id", async (req, res) => {
  try {
    await deleteDepartment(req.userId!, req.workspaceId!, req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete department" });
  }
});