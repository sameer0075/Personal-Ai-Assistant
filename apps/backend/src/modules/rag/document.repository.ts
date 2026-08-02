import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { DocumentRecord, RetrievedChunk, SourceType } from "../../types/index.js";

/** pgvector expects the literal string form: '[0.1,0.2,...]' */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export const documentRepository = {
  async createDocument(title: string, sourceType: SourceType, metadata: Record<string, unknown> = {}): Promise<DocumentRecord> {
    const { rows } = await pool.query<DocumentRecord>(
      `INSERT INTO documents (title, source_type, metadata)
       VALUES ($1, $2, $3)
       RETURNING id, title, source_type, metadata, created_at`,
      [title, sourceType, metadata]
    );
    return rows[0];
  },

  async insertChunks(
    documentId: string,
    chunks: Array<{ content: string; embedding: number[]; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    // Single multi-row INSERT rather than N round-trips.
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

  /**
   * Used by Gmail/Calendar ingestion to avoid re-embedding the same message
   * or event on every sync. `externalId` is whatever ID the source system
   * uses (Gmail message id, Calendar event id), stored in `metadata.externalId`.
   */
  async findByExternalId(sourceType: SourceType, externalId: string): Promise<DocumentRecord | null> {
    const { rows } = await pool.query<DocumentRecord>(
      `SELECT id, title, source_type, metadata, created_at
       FROM documents
       WHERE source_type = $1 AND metadata->>'externalId' = $2
       LIMIT 1`,
      [sourceType, externalId]
    );
    return rows[0] ?? null;
  },

  async deleteDocumentsBySourceType(sourceType: SourceType): Promise<void> {
    // Used when re-uploading a CV: replace the old version rather than accumulate duplicates.
    await pool.query(`DELETE FROM documents WHERE source_type = $1`, [sourceType]);
  },

  /**
   * Cosine similarity search using the HNSW index.
   * `<=>` is pgvector's cosine-distance operator (0 = identical). We convert
   * to a similarity score (1 - distance) so higher = more relevant, matching
   * the RetrievedChunk contract used by the rest of the app.
   */
  async searchSimilarChunks(queryEmbedding: number[], topK: number = env.RAG_TOP_K): Promise<RetrievedChunk[]> {
    const { rows } = await pool.query(
      `SELECT
         c.id, c.document_id, c.chunk_index, c.content, c.metadata, c.created_at,
         1 - (c.embedding <=> $1) AS similarity
       FROM document_chunks c
       ORDER BY c.embedding <=> $1
       LIMIT $2`,
      [toVectorLiteral(queryEmbedding), topK]
    );
    return rows as RetrievedChunk[];
  },

  async getDocumentTitle(documentId: string): Promise<string | null> {
    const { rows } = await pool.query<{ title: string }>(`SELECT title FROM documents WHERE id = $1`, [documentId]);
    return rows[0]?.title ?? null;
  },
};