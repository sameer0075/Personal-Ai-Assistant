import { pool } from "../config/database.js";

export interface StoredFile {
  filename: string;
  mimeType: string;
  base64Data: string;
}

export async function getStoredFileBySourceType(userId: string, sourceType: string): Promise<StoredFile | null> {
  const { rows } = await pool.query<{ title: string; mime_type: string | null; file_data: Buffer | null }>(
    `SELECT title, mime_type, file_data FROM documents
     WHERE user_id = $1 AND source_type = $2 AND file_data IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId, sourceType]
  );

  const row = rows[0];
  if (!row || !row.file_data || !row.mime_type) return null;

  return { filename: row.title, mimeType: row.mime_type, base64Data: row.file_data.toString("base64") };
}