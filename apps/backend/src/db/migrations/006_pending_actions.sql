-- Human-approval queue for anything that sends/publishes on the user's
-- behalf (Gmail sends, LinkedIn posts, and future action types). Nothing in
-- this table has actually happened yet - a row here is a *draft*. The real
-- side effect only fires from pending-actions.service.ts#approvePendingAction,
-- which is only reachable via POST /api/actions/:id/approve after a human
-- reviews it in the UI.
CREATE TABLE IF NOT EXISTS pending_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL CHECK (type IN ('email', 'linkedin_post')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  payload      JSONB NOT NULL,             -- the draft content shown/edited in the approval modal
  created_by   TEXT NOT NULL DEFAULT 'agent' CHECK (created_by IN ('agent', 'user')),
  result       JSONB,                      -- the real Gmail/LinkedIn API response, once approved
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions (status, created_at DESC);