ALTER TABLE google_credentials ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE google_credentials DROP CONSTRAINT IF EXISTS google_credentials_pkey;
ALTER TABLE google_credentials ALTER COLUMN user_label DROP NOT NULL;
ALTER TABLE google_credentials ALTER COLUMN user_label DROP DEFAULT;

-- Superseded by per-workspace uniqueness in 018; skip once google_credentials is workspace-scoped
-- so re-running migrations doesn't fail when a user has one account per workspace.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_credentials' AND column_name = 'workspace_id') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_google_credentials_user_id ON google_credentials (user_id);
  END IF;
END $$;