-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- A "document" is one uploaded source (CV today, later: an email thread, a PR
-- diff, a LinkedIn post draft, etc). `source_type` keeps this generic so future
-- modules (Gmail, GitHub, LinkedIn) plug into the SAME RAG store.
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  source_type  TEXT NOT NULL DEFAULT 'cv', -- 'cv' | 'email' | 'pr' | 'linkedin' | ...
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each document is split into overlapping chunks, each with its own embedding.
-- 384 dimensions = output size of Xenova/all-MiniLM-L6-v2 (must match EMBEDDING_DIMENSIONS).
CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector(384) NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON document_chunks (document_id);

-- HNSW index for fast approximate nearest-neighbour cosine search.
-- vector_cosine_ops matches the "<=>" cosine-distance operator used in queries.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
