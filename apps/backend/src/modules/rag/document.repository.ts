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
    title: string,
    sourceType: SourceType,
    metadata: Record<string, unknown> = {},
    file?: { data: Buffer; mimeType: string }
  ): Promise<DocumentRecord> {
    const { rows } = await pool.query<DocumentRecord>(
      `INSERT INTO documents (user_id, title, source_type, metadata, file_data, mime_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, source_type, metadata, created_at`,
      [userId, title, sourceType, metadata, file?.data ?? null, file?.mimeType ?? null]
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
    sourceType: SourceType
  ): Promise<{ filename: string; mimeType: string; data: Buffer } | null> {
    const { rows } = await pool.query<{ title: string; mime_type: string | null; file_data: Buffer | null }>(
      `SELECT title, mime_type, file_data FROM documents
      WHERE user_id = $1 AND source_type = $2 AND file_data IS NOT NULL
      ORDER BY created_at DESC LIMIT 1`,
      [userId, sourceType]
    );
    const row = rows[0];
    if (!row || !row.file_data || !row.mime_type) return null;
    return { filename: row.title, mimeType: row.mime_type, data: row.file_data };
  },

  async findByExternalId(userId: string, sourceType: SourceType, externalId: string): Promise<DocumentRecord | null> {
    const { rows } = await pool.query<DocumentRecord>(
      `SELECT id, title, source_type, metadata, created_at
       FROM documents
       WHERE user_id = $1 AND source_type = $2 AND metadata->>'externalId' = $3
       LIMIT 1`,
      [userId, sourceType, externalId]
    );
    return rows[0] ?? null;
  },

  async deleteDocumentsBySourceType(userId: string, sourceType: SourceType): Promise<void> {
    await pool.query(`DELETE FROM documents WHERE user_id = $1 AND source_type = $2`, [userId, sourceType]);
  },

  async searchSimilarChunks(
    userId: string,
    queryEmbedding: number[],
    topK: number = env.RAG_TOP_K
  ): Promise<RetrievedChunk[]> {
    const { rows } = await pool.query(
      `SELECT
         c.id, c.document_id, c.chunk_index, c.content, c.metadata, c.created_at,
         1 - (c.embedding <=> $1) AS similarity
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE d.user_id = $2
       ORDER BY c.embedding <=> $1
       LIMIT $3`,
      [toVectorLiteral(queryEmbedding), userId, topK]
    );
    return rows as RetrievedChunk[];
  },

  async getDocumentTitle(documentId: string): Promise<string | null> {
    const { rows } = await pool.query<{ title: string }>(`SELECT title FROM documents WHERE id = $1`, [documentId]);
    return rows[0]?.title ?? null;
  },
};