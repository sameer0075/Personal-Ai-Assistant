import { pool } from "../../config/database.js";
import type {
  PendingAction,
  PendingActionType,
  PendingActionStatus,
} from "../../types/index.js";

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
  id,
  type,
  status,
  payload,
  created_by AS "createdBy",
  result,
  created_at AS "createdAt",
  decided_at AS "decidedAt"
`;

export const pendingActionsRepository = {
  async create(params: {
    type: PendingActionType;
    payload: Record<string, unknown>;
    createdBy: "agent" | "user";
  }): Promise<PendingAction> {
    const { rows } = await pool.query<PendingActionRow>(
      `INSERT INTO pending_actions (type, payload, created_by)
       VALUES ($1, $2, $3)
       RETURNING ${SELECT_COLUMNS}`,
      [params.type, JSON.stringify(params.payload), params.createdBy]
    );
    return rows[0];
  },

  async findById(id: string): Promise<PendingAction | null> {
    const { rows } = await pool.query<PendingActionRow>(
      `SELECT ${SELECT_COLUMNS} FROM pending_actions WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async listPending(): Promise<PendingAction[]> {
    const { rows } = await pool.query<PendingActionRow>(
      `SELECT ${SELECT_COLUMNS} FROM pending_actions
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    );
    return rows;
  },

  async markDecided(
    id: string,
    status: "approved" | "rejected",
    result?: Record<string, unknown>
  ): Promise<PendingAction | null> {
    const { rows } = await pool.query<PendingActionRow>(
      `UPDATE pending_actions
       SET status = $2, result = $3, decided_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING ${SELECT_COLUMNS}`,
      [id, status, result ? JSON.stringify(result) : null]
    );
    return rows[0] ?? null;
  },
};