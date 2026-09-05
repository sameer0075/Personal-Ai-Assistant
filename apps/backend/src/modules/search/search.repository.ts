import { pool } from "../../config/database.js";
import type { UnifiedSearchHit } from "../../types/index.js";

/**
 * Prepares a keyword pattern for ILIKE: the user's query is treated as a
 * *literal substring*, so `%`/`_`/`\` are escaped and wrapped in `%…%`. This
 * keeps "50%" from silently matching every row while still enabling case-
 * insensitive substring search over the bigger text columns.
 */
function toLikePattern(query: string): string {
  const escaped = query.replace(/[\\%_]/g, "\\$&");
  return `%${escaped}%`;
}

export interface ChatMessageSearchRow {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt: string;
  sessionId: string;
  sessionTitle: string;
}

export interface DocumentTitleSearchRow {
  id: string;
  title: string;
  sourceType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LinkedinPostSearchRow {
  id: string;
  commentary: string;
  publishedAt: string;
}

/** One chunk row, returned by both the keyword and the semantic match queries. */
export interface ChunkSearchRow {
  chunkId: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  title: string;
  sourceType: string;
  createdAt: string;
  /** Present only on semantic results (pg returns numerics as strings). */
  similarity?: string;
}

/** Direct chat message rows (keyword match on message content). */
async function searchChatMessages(userId: string, query: string, limit: number): Promise<ChatMessageSearchRow[]> {
  const { rows } = await pool.query<ChatMessageSearchRow>(
    `SELECT m.id,
            m.content,
            m.role,
            m.created_at AS "createdAt",
            m.session_id AS "sessionId",
            s.title      AS "sessionTitle"
     FROM chat_messages m
     JOIN chat_sessions s ON s.id = m.session_id
     WHERE s.user_id = $1
       AND m.content ILIKE $2 ESCAPE '\\'
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [userId, toLikePattern(query), limit]
  );
  return rows;
}

/** Document rows whose title matches (covers knowledge base + synced sources). */
async function searchDocumentsByTitle(userId: string, query: string, limit: number): Promise<DocumentTitleSearchRow[]> {
  const { rows } = await pool.query<DocumentTitleSearchRow>(
    `SELECT id,
            title,
            source_type AS "sourceType",
            metadata,
            created_at AS "createdAt"
     FROM documents
     WHERE user_id = $1
       AND title ILIKE $2 ESCAPE '\\'
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, toLikePattern(query), limit]
  );
  return rows;
}

/** Locally-tracked LinkedIn posts (keyword match on the post commentary). */
async function searchLinkedinPosts(userId: string, query: string, limit: number): Promise<LinkedinPostSearchRow[]> {
  const { rows } = await pool.query<LinkedinPostSearchRow>(
    `SELECT id,
            commentary,
            published_at AS "publishedAt"
     FROM linkedin_posts
     WHERE user_id = $1
       AND deleted_at IS NULL
       AND commentary ILIKE $2 ESCAPE '\\'
     ORDER BY published_at DESC
     LIMIT $3`,
    [userId, toLikePattern(query), limit]
  );
  return rows;
}

/**
 * Keyword hits inside embedded chunks. This is what makes synced emails,
 * events and posts searchable even when their subject/commentary columns are
 * not stored row-by-row (Gmail/Calendar are only embedded, never copied into
 * their own table; their searchable surface is these chunks).
 */
async function searchChunksByKeyword(userId: string, query: string, limit: number): Promise<ChunkSearchRow[]> {
  const { rows } = await pool.query<ChunkSearchRow>(
    `SELECT c.id          AS "chunkId",
            c.document_id AS "documentId",
            c.content,
            c.metadata,
            d.title,
            d.source_type AS "sourceType",
            c.created_at  AS "createdAt"
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.user_id = $1
       AND c.content ILIKE $2 ESCAPE '\\'
     ORDER BY c.created_at DESC
     LIMIT $3`,
    [userId, toLikePattern(query), limit]
  );
  return rows;
}

/**
 * Semantic hits from the pgvector index, JOINed to the document so the title
 * and source_type come back in the same row (keeps one hit-shape for both
 * keyword and semantic paths).
 */
async function searchSimilarChunks(userId: string, queryEmbedding: number[], topK: number): Promise<ChunkSearchRow[]> {
  const { rows } = await pool.query<ChunkSearchRow>(
    `SELECT c.id          AS "chunkId",
            c.document_id AS "documentId",
            c.content,
            c.metadata,
            d.title,
            d.source_type AS "sourceType",
            c.created_at  AS "createdAt",
            1 - (c.embedding <=> $1) AS similarity
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.user_id = $2
     ORDER BY c.embedding <=> $1
     LIMIT $3`,
    [`[${queryEmbedding.join(",")}]`, userId, topK]
  );

  return rows.map((row) => ({ ...row, content: row.content.slice(0, 2000) }));
}

/** Maps a documents.source_type to a unified-search group label source. */
function normalizeChunkSource(sourceType: string): UnifiedSearchHit["source"] {
  switch (sourceType) {
    case "email":
      return "email";
    case "calendar":
      return "calendar";
    case "linkedin":
      return "linkedin";
    case "conversation":
      return "conversation";
    default:
      return "documents";
  }
}

/** Normalizes a chunk row (keyword or semantic) into the hit shape the UI consumes. */
export function chunkRowToHit(row: ChunkSearchRow, matchedBy: "keyword" | "semantic"): UnifiedSearchHit {
  return {
    id: row.chunkId ?? row.documentId,
    source: normalizeChunkSource(row.sourceType),
    title: row.title || "(untitled)",
    snippet: row.content,
    matchedBy,
    similarity: row.similarity !== undefined ? Number(row.similarity) : null,
    createdAt: row.createdAt,
    metadata: row.metadata ?? undefined,
  };
}

export const searchRepository = {
  searchChatMessages,
  searchDocumentsByTitle,
  searchLinkedinPosts,
  searchChunksByKeyword,
  searchSimilarChunks,
  toLikePattern,
};