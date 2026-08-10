import { extractTextFromFile } from "../parsing/file-parser.js";
import { documentRepository } from "./document.repository.js";
import { ingestText, type IngestResult } from "./ingest-text.service.js";
import type { SourceType } from "../../types/index.js";

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
    file: { data: buffer, mimeType: mimeTypeFor(filename) }, // NEW — this is the fix
  });
}