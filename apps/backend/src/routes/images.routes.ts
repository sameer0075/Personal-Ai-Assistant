import { Router } from "express";
import { getGeneratedImage } from "../modules/image-gen/generated-image.repository.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";

/**
 * Serves a generated image to the approval UI as a preview (user-scoped, read-only).
 * Rows are consumed (deleted) by mcp-linkedin only when the post is actually
 * approved and published, so previewing never destroys the handoff.
 */
export const imageRoutes = Router();
imageRoutes.use(requireAuth);

imageRoutes.get("/:id", async (req, res) => {
  try {
    const image = await getGeneratedImage(req.params.id, req.userId!);
    if (!image) {
      res.status(404).json({ error: "Image not found - it may have already been used in a published post" });
      return;
    }
    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.send(image.data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load image" });
  }
});