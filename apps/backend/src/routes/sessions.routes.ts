import { Router } from "express";
import { listSessions, getAllMessages, deleteSession } from "../modules/chat-sessions/chat-session.service.js";
import { getPendingAction } from "../modules/actions/pending-actions.service.js";
import type { PendingAction } from "../types/index.js";

export const sessionsRoutes = Router();

sessionsRoutes.get("/", async (_req, res) => {
  res.json(await listSessions());
});

sessionsRoutes.get("/:id/messages", async (req, res) => {
  try {
    const messages = await getAllMessages(req.params.id);

    const withPendingActions = await Promise.all(
      messages.map(async (m) => {
        const pendingActions = m.pendingActionIds?.length
          ? (await Promise.all(m.pendingActionIds.map((id) => getPendingAction(id)))).filter(
              (a): a is PendingAction => a !== null
            )
          : [];
        return {
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls ?? [],
          pendingActions,
        };
      })
    );

    res.json(withPendingActions);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to load session" });
  }
});

sessionsRoutes.delete("/:id", async (req, res) => {
  try {
    await deleteSession(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Failed to delete session" });
  }
});