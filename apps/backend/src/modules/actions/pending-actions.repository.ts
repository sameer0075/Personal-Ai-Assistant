import { pool } from "../../config/database.js";
import type { PendingAction, PendingActionType, PendingActionStatus } from "../../types/index.js";

interface PendingActionRow {
  id: string;
  type: PendingActionType;
  status: PendingActionStatus;
  payload: PendingAction["payload"];
  createdBy: "agent" | "user";
  result: Record<string, unknown> | null;
  createdAt: string;
  decidedAt: string | null;
}

const SELECT_COLUMNS = `
  id, type, status, payload, created_by AS "createdBy", result,
  created_at AS "createdAt", decided_at AS "decidedAt"
`;

export const pendingActionsRepository = {
  async create(params: {
    userId: string;
    type: PendingActionType;
    payload: Record<string, unknown>;
    createdBy: "agent" | "user";
  }): Promise<PendingAction> {
    const { rows } = await pool.query<PendingActionRow>(
      `INSERT INTO pending_actions (user_id, type, payload, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT_COLUMNS}`,
      [params.userId, params.type, JSON.stringify(params.payload), params.createdBy]
    );
    return rows[0];
  },

  /** Scoped by userId so one user can never approve/reject/even see another user's drafted email or LinkedIn post. */
  async findById(id: string, userId: string): Promise<PendingAction | null> {
    const { rows } = await pool.query<PendingActionRow>(
      `SELECT ${SELECT_COLUMNS} FROM pending_actions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] ?? null;
  },

  async listPending(userId: string): Promise<PendingAction[]> {
    const { rows } = await pool.query<PendingActionRow>(
      `SELECT ${SELECT_COLUMNS} FROM pending_actions WHERE status = 'pending' AND user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  async markDecided(
    id: string,
    userId: string,
    status: "approved" | "rejected",
    result?: Record<string, unknown>
  ): Promise<PendingAction | null> {
    const { rows } = await pool.query<PendingActionRow>(
      `UPDATE pending_actions SET status = $3, result = $4, decided_at = now()
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING ${SELECT_COLUMNS}`,
      [id, userId, status, result ? JSON.stringify(result) : null]
    );
    return rows[0] ?? null;
  },
};