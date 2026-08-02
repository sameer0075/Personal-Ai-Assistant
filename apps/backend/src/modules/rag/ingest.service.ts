import { extractTextFromFile } from "../parsing/file-parser.js";
import { documentRepository } from "./document.repository.js";
import { ingestText, type IngestResult } from "./ingest-text.service.js";
import type { SourceType } from "../../types/index.js";

export type { IngestResult } from "./ingest-text.service.js";

/**
 * File-specific entry point into the shared ingestion pipeline: extract text
 * from the upload (pdf/docx/txt), then hand off to `ingestText`.
 */
export async function ingestFile(params: {
  buffer: Buffer;
  filename: string;
  sourceType: SourceType;
  replaceExisting?: boolean;
}): Promise<IngestResult> {
  const { buffer, filename, sourceType, replaceExisting = false } = params;

  if (replaceExisting) {
    await documentRepository.deleteDocumentsBySourceType(sourceType);
  }

  const rawText = await extractTextFromFile(buffer, filename);

  return ingestText({
    text: rawText,
    title: filename,
    sourceType,
    metadata: { originalFilename: filename },
  });
}