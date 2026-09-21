import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { DocumentRecord, RetrievedChunk, SourceType } from "../../types/index.js";

/** pgvector expects the literal string form: '[0.1,0.2,...]' */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export const documentRepository = {
  async createDocument(
    userId: string,
    workspaceId: string,
    title: string,
    sourceType: SourceType,
    metadata: Record<string, unknown> = {},
    file?: { data: Buffer; mimeType: string }
  ): Promise<DocumentRecord> {
    const { rows } = await pool.query<DocumentRecord>(
      `INSERT INTO documents (user_id, workspace_id, title, source_type, metadata, file_data, mime_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, title, source_type, metadata, created_at`,
      [userId, workspaceId, title, sourceType, metadata, file?.data ?? null, file?.mimeType ?? null]
    );
    return rows[0];
  },

  async insertChunks(
    documentId: string,
    chunks: Array<{ content: string; embedding: number[]; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    const values: unknown[] = [];
    const rowsSql: string[] = [];

    chunks.forEach((chunk, i) => {
      const base = i * 5;
      rowsSql.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
      values.push(documentId, i, chunk.content, toVectorLiteral(chunk.embedding), chunk.metadata ?? {});
    });

    await pool.query(
      `INSERT INTO document_chunks (document_id, chunk_index, content, embedding, metadata)
       VALUES ${rowsSql.join(", ")}`,
      values
    );
  },

  async getLatestFileBySourceType(
    userId: string,
    workspaceId: string,
    sourceType: SourceType
  ): Promise<{ filename: string; mimeType: string; data: Buffer } | null> {
    const { rows } = await pool.query<{ title: string; mime_type: string | null; file_data: Buffer | null }>(
      `SELECT title, mime_type, file_data FROM documents
      WHERE user_id = $1 AND workspace_id = $2 AND source_type = $3 AND file_data IS NOT NULL
      ORDER BY created_at DESC LIMIT 1`,
      [userId, workspaceId, sourceType]
    );
    const row = rows[0];
    if (!row || !row.file_data || !row.mime_type) return null;
    return { filename: row.title, mimeType: row.mime_type, data: row.file_data };
  },

  async findByExternalId(userId: string, workspaceId: string, sourceType: SourceType, externalId: string): Promise<DocumentRecord | null> {
    const { rows } = await pool.query<DocumentRecord>(
      `SELECT id, title, source_type, metadata, created_at
       FROM documents
      WHERE user_id = $1 AND workspace_id = $2 AND source_type = $3 AND metadata->>'externalId' = $4
       LIMIT 1`,
          [userId, workspaceId, sourceType, externalId]
    );
    return rows[0] ?? null;
  },

  async deleteDocumentsBySourceType(userId: string, workspaceId: string, sourceType: SourceType): Promise<void> {
    // HR documents (applicant/employee CVs, policies) share source types with the
    // user's own uploads but must never be swept away by a "replace my CV" upload.
    await pool.query(
      `DELETE FROM documents
       WHERE user_id = $1 AND workspace_id = $2 AND source_type = $3 AND COALESCE(metadata->>'department', '') <> 'hr'`,
      [userId, workspaceId, sourceType]
    );
  },

  async listWorkspaceResources(userId: string, workspaceId: string): Promise<Array<{
    id: string;
    title: string;
    sourceType: SourceType;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>> {
    const { rows } = await pool.query(
      `SELECT id, title, source_type AS "sourceType", metadata, created_at AS "createdAt"
       FROM documents
       WHERE user_id = $1 AND workspace_id = $2
         AND (metadata->>'department' = 'hr' OR metadata->>'departmentId' IN (
           SELECT id::text FROM departments WHERE workspace_id = $2 AND name = 'HR Management'
         ))
       ORDER BY created_at DESC`,
      [userId, workspaceId]
    );
    return rows as Array<{ id: string; title: string; sourceType: SourceType; metadata: Record<string, unknown>; createdAt: string }>;
  },

  async deleteDocument(id: string, userId: string, workspaceId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM documents
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3
         AND (metadata->>'department' = 'hr' OR metadata->>'departmentId' IN (
           SELECT id::text FROM departments WHERE workspace_id = $3 AND name = 'HR Management'
         ))`,
      [id, userId, workspaceId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async searchSimilarChunks(
    userId: string,
    workspaceId: string,
    queryEmbedding: number[],
    topK: number = env.RAG_TOP_K
  ): Promise<RetrievedChunk[]> {
    const { rows } = await pool.query(
      `SELECT
         c.id, c.document_id, c.chunk_index, c.content, c.metadata, c.created_at,
         1 - (c.embedding <=> $1) AS similarity
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE d.user_id = $2 AND d.workspace_id = $3
       ORDER BY c.embedding <=> $1
       LIMIT $4`,
      [toVectorLiteral(queryEmbedding), userId, workspaceId, topK]
    );
    return rows as RetrievedChunk[];
  },

  async getDocumentTitle(documentId: string): Promise<string | null> {
    const { rows } = await pool.query<{ title: string }>(`SELECT title FROM documents WHERE id = $1`, [documentId]);
    return rows[0]?.title ?? null;
  },
};