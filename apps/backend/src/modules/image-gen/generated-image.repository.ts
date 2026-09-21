import { pool } from "../../config/database.js";

/**
 * Stores image bytes and returns a short reference id. The LLM only ever
 * sees this id (via the generate_image tool's response) - never the raw
 * bytes - keeping tool-call payloads small and cheap. mcp-linkedin looks the
 * row up by this same id when linkedin_create_post is called with it.
 */
export async function storeGeneratedImage(params: {
  userId?: string;
  data: Buffer;
  mimeType: string;
  prompt: string;
}): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO generated_images (user_id, mime_type, image_data, prompt)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [params.userId ?? null, params.mimeType, params.data, params.prompt]
  );
  return rows[0].id;
}

/**
 * Read-only fetch for the approval UI preview - unlike mcp-linkedin's
 * consumeGeneratedImage, this does NOT delete the row, so the image can still
 * be consumed when the user approves the post.
 */
export async function getGeneratedImage(
  imageRef: string,
  userId: string
): Promise<{ mimeType: string; data: Buffer } | null> {
  const { rows } = await pool.query<{ mime_type: string; image_data: Buffer }>(
    `SELECT mime_type, image_data FROM generated_images WHERE id = $1 AND user_id = $2`,
    [imageRef, userId]
  );
  const row = rows[0];
  return row ? { mimeType: row.mime_type, data: row.image_data } : null;
}