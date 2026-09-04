-- First module of multi-user support: real accounts. Every other table
-- (documents, chat_sessions, google_credentials, linkedin_credentials, ...)
-- is still shared/global as of this migration - they get their own user_id
-- foreign key in later modules, one at a time. This migration only adds the
-- users table itself and gates the API behind requireAuth.
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness/lookup (the UNIQUE constraint above is
-- case-sensitive; this index is what findByEmail's lower(email) actually uses).
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));