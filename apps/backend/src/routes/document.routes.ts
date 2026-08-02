import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { ingestFile } from "../modules/rag/ingest.service.js";

export const documentRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const uploadQuerySchema = z.object({
  sourceType: z.enum(["cv", "email", "pr", "linkedin", "calendar", "general"]).default("cv"),
  replaceExisting: z.coerce.boolean().default(true),
});

/**
 * POST /api/documents/upload
 * multipart/form-data, field name "file". Defaults to sourceType=cv and
 * replaces any previously-uploaded CV, since a user typically has one current CV.
 */
documentRoutes.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Send multipart/form-data with field 'file'." });
    }

    const { sourceType, replaceExisting } = uploadQuerySchema.parse(req.query);

    const result = await ingestFile({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      sourceType,
      replaceExisting,
    });

    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during ingestion";
    res.status(422).json({ error: message });
  }
});
