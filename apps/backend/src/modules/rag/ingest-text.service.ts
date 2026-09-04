import { chunkText } from "./chunker.js";
import { embeddingService } from "../embeddings/embedding.service.js";
import { documentRepository } from "./document.repository.js";
import type { SourceType } from "../../types/index.js";

export interface IngestResult {
  documentId: string;
  title: string;
  chunkCount: number;
}

export interface IngestTextParams {
  userId: string;
  text: string;
  title: string;
  sourceType: SourceType;
  metadata?: Record<string, unknown>;
  file?: { data: Buffer; mimeType: string };
}

export async function ingestText(params: IngestTextParams): Promise<IngestResult> {
  const { userId, text, title, sourceType, metadata = {}, file } = params;
  if (!text.trim()) throw new Error(`No text to ingest for "${title}"`);

  const chunks = chunkText(text);
  const embeddings = await embeddingService.embedBatch(chunks);
  const document = await documentRepository.createDocument(userId, title, sourceType, metadata, file);

  await documentRepository.insertChunks(
    document.id,
    chunks.map((content, i) => ({ content, embedding: embeddings[i] }))
  );

  return { documentId: document.id, title: document.title, chunkCount: chunks.length };
}