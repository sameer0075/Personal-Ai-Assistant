// apps/mcp-gmail-calendar-server/src/google/document-file.repository.ts
import { pool } from "../config/database.js"; // same pool credentials.repository.ts uses

export interface StoredFile {
  filename: string;
  mimeType: string;
  base64Data: string;
}

/**
 * Reads a previously-uploaded file's raw bytes straight out of the `documents`
 * table (populated by apps/backend's ingestFile, which now persists file_data +
 * mime_type alongside the chunked text). This is what lets gmail_send_message
 * actually attach the CV instead of just paraphrasing its indexed text.
 */
export async function getStoredFileBySourceType(sourceType: string): Promise<StoredFile | null> {
  const { rows } = await pool.query<{ title: string; mime_type: string | null; file_data: Buffer | null }>(
    `SELECT title, mime_type, file_data FROM documents
     WHERE source_type = $1 AND file_data IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [sourceType]
  );

  const row = rows[0];
  if (!row || !row.file_data || !row.mime_type) return null;

  return {
    filename: row.title,
    mimeType: row.mime_type,
    base64Data: row.file_data.toString("base64"),
  };
}