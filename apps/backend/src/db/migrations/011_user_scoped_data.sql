-- Second module of multi-user support: real per-user data isolation for the
-- three tables that hold anything sensitive - the knowledge base (documents/
-- document_chunks, via documents.user_id), chat history (chat_sessions ->
-- chat_messages via the existing session_id FK, so no new column needed
-- there), and drafted-but-not-yet-sent actions (pending_actions).
--
-- Columns are nullable at the DB level (not NOT NULL) so this migration
-- never fails against a database that already has rows from before user
-- accounts existed. Every application-level query written against these
-- tables from this module onward always filters by user_id, so a NULL row
-- is simply invisible to everyone rather than a data leak - it's dead data,
-- not a security hole. If you're running this against a fresh dev database
-- (the common case), there won't be any such rows anyway.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents (user_id);

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions (user_id);

ALTER TABLE pending_actions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pending_actions_user_id ON pending_actions (user_id);