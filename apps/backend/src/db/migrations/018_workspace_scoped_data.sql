-- Existing user data belongs to the Personal workspace. Work data is created
-- empty and is isolated by workspace_id from its first write.
INSERT INTO workspaces (user_id, kind, name)
SELECT id, 'personal', 'Personal' FROM users
ON CONFLICT DO NOTHING;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE pending_actions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE google_credentials ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE linkedin_credentials ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE linkedin_posts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE generated_images ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE github_credentials ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

UPDATE documents d SET workspace_id = w.id
FROM workspaces w WHERE d.workspace_id IS NULL AND w.user_id = d.user_id AND w.kind = 'personal';
UPDATE chat_sessions c SET workspace_id = w.id
FROM workspaces w WHERE c.workspace_id IS NULL AND w.user_id = c.user_id AND w.kind = 'personal';
UPDATE pending_actions p SET workspace_id = w.id
FROM workspaces w WHERE p.workspace_id IS NULL AND w.user_id = p.user_id AND w.kind = 'personal';
UPDATE google_credentials g SET workspace_id = w.id
FROM workspaces w WHERE g.workspace_id IS NULL AND w.user_id = g.user_id AND w.kind = 'personal';
UPDATE linkedin_credentials l SET workspace_id = w.id
FROM workspaces w WHERE l.workspace_id IS NULL AND w.user_id = l.user_id AND w.kind = 'personal';
UPDATE linkedin_posts l SET workspace_id = w.id
FROM workspaces w WHERE l.workspace_id IS NULL AND w.user_id = l.user_id AND w.kind = 'personal';
UPDATE generated_images g SET workspace_id = w.id
FROM workspaces w WHERE g.workspace_id IS NULL AND w.user_id = g.user_id AND w.kind = 'personal';
UPDATE scheduled_tasks s SET workspace_id = w.id
FROM workspaces w WHERE s.workspace_id IS NULL AND w.user_id = s.user_id AND w.kind = 'personal';
UPDATE github_credentials g SET workspace_id = w.id
FROM workspaces w WHERE g.workspace_id IS NULL AND w.user_id = g.user_id AND w.kind = 'personal';

CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON documents (workspace_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace_id ON chat_sessions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_workspace_id ON pending_actions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_workspace_id ON scheduled_tasks (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_credentials_workspace_id ON google_credentials (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_credentials_workspace_id ON linkedin_credentials (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_github_credentials_workspace_id ON github_credentials (workspace_id);

DROP INDEX IF EXISTS idx_google_credentials_user_id;
DROP INDEX IF EXISTS idx_linkedin_credentials_user_id;
ALTER TABLE github_credentials DROP CONSTRAINT IF EXISTS github_credentials_pkey;