import { pool } from "../../config/database.js";
import type { ScheduledTask } from "../../types/index.js";

const SCHEDULED_TASK_COLUMNS = `
  id,
  user_id AS "userId",
  title,
  prompt,
  schedule_kind AS "scheduleKind",
  cron_expr AS "cronExpr",
  interval_minutes AS "intervalMinutes",
  timezone,
  trigger_at AS "triggerAt",
  enabled,
  delivery_mode AS "deliveryMode",
  email_to AS "emailTo",
  email_subject AS "emailSubject",
  deliver_to_session_id AS "deliverToSessionId",
  last_run_at AS "lastRunAt",
  last_error AS "lastError",
  run_count AS "runCount",
  created_at AS "createdAt"
`;

export interface CreateScheduledTask {
  userId: string;
  title: string;
  prompt: string;
  scheduleKind: ScheduledTask["scheduleKind"];
  cronExpr: string | null;
  intervalMinutes: number | null;
  timezone: string;
  triggerAt: Date;
  deliveryMode: ScheduledTask["deliveryMode"];
  emailTo: string | null;
  emailSubject: string | null;
  deliverToSessionId: string | null;
}

export interface UpdateScheduledTask {
  title?: string;
  prompt?: string;
  scheduleKind?: ScheduledTask["scheduleKind"];
  cronExpr?: string | null;
  intervalMinutes?: number | null;
  timezone?: string;
  triggerAt?: Date;
  enabled?: boolean;
  deliveryMode?: ScheduledTask["deliveryMode"];
  emailTo?: string | null;
  emailSubject?: string | null;
  deliverToSessionId?: string | null;
}

export const automationsRepository = {
  async create(params: CreateScheduledTask): Promise<ScheduledTask> {
    const { rows } = await pool.query<ScheduledTask>(
      `INSERT INTO scheduled_tasks
         (user_id, title, prompt, schedule_kind, cron_expr, interval_minutes, timezone, trigger_at,
          delivery_mode, email_to, email_subject, deliver_to_session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${SCHEDULED_TASK_COLUMNS}`,
      [
        params.userId, params.title, params.prompt, params.scheduleKind,
        params.cronExpr, params.intervalMinutes, params.timezone, params.triggerAt,
        params.deliveryMode, params.emailTo, params.emailSubject,
        params.deliverToSessionId,
      ]
    );
    return rows[0];
  },

  async list(userId: string): Promise<ScheduledTask[]> {
    const { rows } = await pool.query<ScheduledTask>(
      `SELECT ${SCHEDULED_TASK_COLUMNS} FROM scheduled_tasks WHERE user_id = $1 ORDER BY trigger_at ASC`,
      [userId]
    );
    return rows;
  },

  async get(id: string, userId: string): Promise<ScheduledTask | null> {
    const { rows } = await pool.query<ScheduledTask>(
      `SELECT ${SCHEDULED_TASK_COLUMNS} FROM scheduled_tasks WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] ?? null;
  },

  async update(id: string, userId: string, patch: UpdateScheduledTask): Promise<ScheduledTask | null> {
    const { rows } = await pool.query<ScheduledTask>(
      `UPDATE scheduled_tasks SET
         title = COALESCE($3, title),
         prompt = COALESCE($4, prompt),
         schedule_kind = COALESCE($5, schedule_kind),
         cron_expr = COALESCE($6, cron_expr),
         interval_minutes = COALESCE($7, interval_minutes),
         timezone = COALESCE($8, timezone),
         trigger_at = COALESCE($9, trigger_at),
         enabled = COALESCE($10, enabled),
         delivery_mode = COALESCE($11, delivery_mode),
         email_to = COALESCE($12, email_to),
         email_subject = COALESCE($13, email_subject),
         deliver_to_session_id = COALESCE($14, deliver_to_session_id),
         updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING ${SCHEDULED_TASK_COLUMNS}`,
      [
        id, userId,
        patch.title ?? null, patch.prompt ?? null, patch.scheduleKind ?? null,
        patch.cronExpr ?? null, patch.intervalMinutes ?? null, patch.timezone ?? null,
        patch.triggerAt ?? null, patch.enabled ?? null,
        patch.deliveryMode ?? null, patch.emailTo ?? null, patch.emailSubject ?? null,
        patch.deliverToSessionId === undefined ? null : patch.deliverToSessionId,
      ]
    );
    return rows[0] ?? null;
  },

  async remove(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(`DELETE FROM scheduled_tasks WHERE id = $1 AND user_id = $2`, [id, userId]);
    return (rowCount ?? 0) > 0;
  },

  /**
   * Atomically claims every due, enabled task whose claim has gone stale.
   * `FOR UPDATE SKIP LOCKED` means concurrent workers (or overlapping polls)
   * never double-run a task - each row is locked exactly once.
   */
  async claimDue(now: Date, staleSince: Date): Promise<ScheduledTask[]> {
    const { rows } = await pool.query<ScheduledTask>(
      `UPDATE scheduled_tasks SET running_since = now()
       WHERE id IN (
         SELECT id FROM scheduled_tasks
         WHERE enabled = TRUE
           AND trigger_at <= $1
           AND (running_since IS NULL OR running_since <= $2)
         FOR UPDATE SKIP LOCKED
       )
       RETURNING ${SCHEDULED_TASK_COLUMNS}`,
      [now, staleSince]
    );
    return rows;
  },

  async markSuccess(id: string, lastRunAt: Date, nextTriggerAt: Date | null, enabledAfter: boolean): Promise<void> {
    await pool.query(
      `UPDATE scheduled_tasks SET
         running_since = NULL,
         last_run_at = $2,
         last_error = NULL,
         run_count = run_count + 1,
         trigger_at = COALESCE($3, trigger_at),
         enabled = $4,
         updated_at = now()
       WHERE id = $1`,
      [id, lastRunAt, nextTriggerAt, enabledAfter]
    );
  },

  async markFailed(id: string, error: string): Promise<void> {
    await pool.query(
      `UPDATE scheduled_tasks SET
         running_since = NULL,
         last_error = $2,
         updated_at = now()
       WHERE id = $1`,
      [id, error]
    );
  },
};