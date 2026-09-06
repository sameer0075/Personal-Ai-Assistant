-- Automations: email delivery support (chat / email / both).
-- Idempotent — the migration runner re-executes every file on every boot.

ALTER TABLE scheduled_tasks
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'chat'; -- 'chat' | 'email' | 'both'
ALTER TABLE scheduled_tasks
  ADD COLUMN IF NOT EXISTS email_to text; -- defaults to the user's connected Gmail
ALTER TABLE scheduled_tasks
  ADD COLUMN IF NOT EXISTS email_subject text; -- defaults to "[Automation: <title>]"

DO $$
BEGIN
  ALTER TABLE scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_delivery_mode_check
    CHECK (delivery_mode IN ('chat', 'email', 'both'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;