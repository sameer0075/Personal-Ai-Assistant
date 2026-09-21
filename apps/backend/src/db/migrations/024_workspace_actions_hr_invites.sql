-- Approvals run against a specific workspace's connected accounts (Work Gmail vs
-- Personal Gmail), so each pending action records the workspace it belongs to.
ALTER TABLE pending_actions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE pending_actions p SET workspace_id = w.id
FROM workspaces w
WHERE p.workspace_id IS NULL AND w.user_id = p.user_id AND w.kind = 'personal';
CREATE INDEX IF NOT EXISTS idx_pending_actions_workspace ON pending_actions (workspace_id, status, created_at DESC);

-- HR event invitations (calendar invite + email to employees) go through approval.
ALTER TABLE pending_actions DROP CONSTRAINT IF EXISTS pending_actions_type_check;
ALTER TABLE pending_actions
  ADD CONSTRAINT pending_actions_type_check
  CHECK (type IN ('email', 'linkedin_post', 'github_issue', 'github_comment', 'hr_event_invite'));

ALTER TABLE hr_events ADD COLUMN IF NOT EXISTS invite_action_id UUID REFERENCES pending_actions(id) ON DELETE SET NULL;
ALTER TABLE hr_events ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
