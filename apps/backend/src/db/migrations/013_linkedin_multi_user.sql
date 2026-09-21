-- Multi-user support for LinkedIn: per-user credentials, post history, and image handoff.
ALTER TABLE linkedin_credentials ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE linkedin_credentials DROP CONSTRAINT IF EXISTS linkedin_credentials_pkey;
ALTER TABLE linkedin_credentials ALTER COLUMN user_label DROP NOT NULL;
ALTER TABLE linkedin_credentials ALTER COLUMN user_label DROP DEFAULT;

-- Superseded by per-workspace uniqueness in 018; skip once linkedin_credentials is workspace-scoped
-- so re-running migrations doesn't fail when a user has one account per workspace.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_credentials' AND column_name = 'workspace_id') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_credentials_user_id ON linkedin_credentials (user_id);
  END IF;
END $$;

ALTER TABLE linkedin_posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_user_id ON linkedin_posts (user_id);

ALTER TABLE generated_images ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_generated_images_user_id ON generated_images (user_id);

