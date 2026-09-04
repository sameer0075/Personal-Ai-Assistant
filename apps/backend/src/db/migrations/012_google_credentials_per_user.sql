ALTER TABLE google_credentials ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE google_credentials DROP CONSTRAINT IF EXISTS google_credentials_pkey;
ALTER TABLE google_credentials ALTER COLUMN user_label DROP NOT NULL;
ALTER TABLE google_credentials ALTER COLUMN user_label DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_credentials_user_id ON google_credentials (user_id);