-- Single-user personal assistant, same pattern as google_credentials.
-- access_token_encrypted is always present; refresh_token_encrypted is nullable
-- because LinkedIn only issues a refresh token to apps with "Programmatic
-- Refresh Tokens" access approved - without it, access_token simply expires
-- after ~60 days and the user has to reconnect.
CREATE TABLE IF NOT EXISTS linkedin_credentials (
  user_label               TEXT PRIMARY KEY DEFAULT 'default',
  person_urn                TEXT NOT NULL,
  access_token_encrypted    TEXT NOT NULL,
  refresh_token_encrypted   TEXT,
  expires_at                TIMESTAMPTZ NOT NULL,
  granted_scopes            TEXT[] NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LinkedIn restricts r_member_social (reading a personal profile's own post
-- history) to specially-approved apps - most developer apps will never get
-- it. So instead of relying on LinkedIn's API to answer "what have I already
-- posted", the MCP server keeps its own record here every time it publishes
-- or deletes a post through linkedin_create_post / linkedin_delete_post.
CREATE TABLE IF NOT EXISTS linkedin_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_urn      TEXT NOT NULL UNIQUE,
  commentary    TEXT NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);