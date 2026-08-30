-- Files attached directly to a chat message (e.g. "here's a contract, what's
-- the notice period?"). Deliberately separate from the documents/document_chunks
-- RAG pipeline (see modules/rag/*): a chat attachment is scoped to answering
-- questions within its own conversation, not embedded and searched across the
-- whole knowledge base. See modules/chat-sessions/attachment-format.ts.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachments JSONB;