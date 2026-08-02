-- Single-user personal assistant: one row of Google credentials, upserted by
-- `user_label`. If this ever becomes multi-user, `user_label` becomes a real
-- foreign key to a users table - no other schema changes needed.
CREATE TABLE IF NOT EXISTS google_credentials (
  user_label               TEXT PRIMARY KEY DEFAULT 'default',
  google_email              TEXT,
  refresh_token_encrypted   TEXT NOT NULL,
  granted_scopes            TEXT[] NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);