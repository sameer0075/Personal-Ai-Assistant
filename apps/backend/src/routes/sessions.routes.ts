import { Router } from "express";
import { listSessions, getAllMessages, deleteSession } from "../modules/chat-sessions/chat-session.service.js";
import { getPendingAction } from "../modules/actions/pending-actions.service.js";
import type { PendingAction } from "../types/index.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";

export const sessionsRoutes = Router();
sessionsRoutes.use(requireAuth);

sessionsRoutes.get("/", async (req, res) => {
  res.json(await listSessions(req.userId!));
});

sessionsRoutes.get("/:id/messages", async (req, res) => {
  try {
    const messages = await getAllMessages(req.params.id, req.userId!);

    const withPendingActions = await Promise.all(
      messages.map(async (m) => {
        const pendingActions = m.pendingActionIds?.length
          ? (await Promise.all(m.pendingActionIds.map((id) => getPendingAction(id, req.userId!)))).filter(
              (a): a is PendingAction => a !== null
            )
          : [];
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls ?? [],
          pendingActions,
          attachments: m.attachments ?? [],
        };
      })
    );

    res.json(withPendingActions);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Failed to load session" });
  }
});

sessionsRoutes.delete("/:id", async (req, res) => {
  try {
    await deleteSession(req.params.id, req.userId!);
    res.json({ deleted: true });
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to delete session" });
  }
});