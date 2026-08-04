import { pool } from "../config/database.js";

export interface StoredImage {
  data: Buffer;
  mimeType: string;
}

/**
 * Reads the row the backend's generate_image tool wrote (see apps/backend's
 * generated-image.repository.ts) and deletes it immediately after - this
 * table is a one-shot handoff buffer between the two processes, not storage.
 */
export async function consumeGeneratedImage(imageRef: string): Promise<StoredImage> {
  const { rows } = await pool.query<{ mime_type: string; image_data: Buffer }>(
    `DELETE FROM generated_images WHERE id = $1 RETURNING mime_type, image_data`,
    [imageRef]
  );

  if (!rows[0]) {
    throw new Error(
      `No generated image found for imageRef "${imageRef}" - it may have already been used, or expired. Call generate_image again right before posting.`
    );
  }

  return { data: rows[0].image_data, mimeType: rows[0].mime_type };
}