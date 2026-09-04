import { pool } from "../config/database.js";

export interface StoredImage {
  data: Buffer;
  mimeType: string;
}

/**
 * Reads the row the backend's generate_image tool wrote (see apps/backend's
 * generated-image.repository.ts) and deletes it immediately after - this
 * table is a one-shot handoff buffer between the two processes, not storage.
 * Scoped by userId to ensure users can only consume their own generated images.
 */
export async function consumeGeneratedImage(userId: string, imageRef: string): Promise<StoredImage> {
  const { rows } = await pool.query<{ mime_type: string; image_data: Buffer }>(
    `DELETE FROM generated_images WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) RETURNING mime_type, image_data`,
    [imageRef, userId]
  );

  if (!rows[0]) {
    throw new Error(
      `No generated image found for imageRef "${imageRef}" - it may have already been used, or expired. Call generate_image again right before posting.`
    );
  }

  return { data: rows[0].image_data, mimeType: rows[0].mime_type };
}