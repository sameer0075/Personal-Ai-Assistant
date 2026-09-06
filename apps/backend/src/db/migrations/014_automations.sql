-- Scheduled automations: one-shot, interval, or cron tasks that wake the
-- assistant agent and deliver its answer into the user's chat.
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                  TEXT NOT NULL,
  prompt                 TEXT NOT NULL,
  schedule_kind          TEXT NOT NULL DEFAULT 'cron'
                         CHECK (schedule_kind IN ('once', 'interval', 'cron')),
  cron_expr              TEXT,
  interval_minutes       INTEGER,
  timezone               TEXT NOT NULL DEFAULT 'UTC',
  trigger_at             TIMESTAMPTZ NOT NULL,
  enabled                BOOLEAN NOT NULL DEFAULT TRUE,
  deliver_to_session_id  UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  running_since          TIMESTAMPTZ,          -- claim marker; NULL when idle
  last_run_at            TIMESTAMPTZ,
  last_error             TEXT,
  run_count              INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due ON scheduled_tasks (trigger_at) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user ON scheduled_tasks (user_id);