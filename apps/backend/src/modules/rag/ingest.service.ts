import { extractTextFromFile } from "../parsing/file-parser.js";
import { documentRepository } from "./document.repository.js";
import { ingestText, type IngestResult } from "./ingest-text.service.js";
import type { SourceType } from "../../types/index.js";

export type { IngestResult } from "./ingest-text.service.js";

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

function mimeTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

export async function ingestFile(params: {
  userId: string;
  workspaceId: string;
  buffer: Buffer;
  filename: string;
  sourceType: SourceType;
  metadata?: Record<string, unknown>;
  replaceExisting?: boolean;
}): Promise<IngestResult> {
  const { userId, workspaceId, buffer, filename, sourceType, metadata = {}, replaceExisting = false } = params;

  if (replaceExisting) {
    await documentRepository.deleteDocumentsBySourceType(userId, workspaceId, sourceType);
  }

  const rawText = await extractTextFromFile(buffer, filename);

  return ingestText({
    userId,
    workspaceId,
    text: rawText,
    title: filename,
    sourceType,
    metadata: { originalFilename: filename, ...metadata },
    file: { data: buffer, mimeType: mimeTypeFor(filename) }
  });
}