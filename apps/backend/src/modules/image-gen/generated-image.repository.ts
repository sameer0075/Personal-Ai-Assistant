import { pool } from "../../config/database.js";

/**
 * Stores image bytes and returns a short reference id. The LLM only ever
 * sees this id (via the generate_image tool's response) - never the raw
 * bytes - keeping tool-call payloads small and cheap. mcp-linkedin looks the
 * row up by this same id when linkedin_create_post is called with it.
 */
export async function storeGeneratedImage(params: { data: Buffer; mimeType: string; prompt: string }): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO generated_images (mime_type, image_data, prompt)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [params.mimeType, params.data, params.prompt]
  );
  return rows[0].id;
}