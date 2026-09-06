-- GitHub integration: per-user PAT storage + new pending-action types.
-- Idempotent — the migration runner re-executes every file on every boot.

CREATE TABLE IF NOT EXISTS github_credentials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  github_login TEXT NOT NULL,
  github_token_encrypted TEXT NOT NULL,
  github_email TEXT,
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Widen the pending_actions type allow-list for GitHub-drafted issues/comments.
ALTER TABLE pending_actions DROP CONSTRAINT IF EXISTS pending_actions_type_check;
ALTER TABLE pending_actions
  ADD CONSTRAINT pending_actions_type_check
  CHECK (type IN ('email', 'linkedin_post', 'github_issue', 'github_comment'));