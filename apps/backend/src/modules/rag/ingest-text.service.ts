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
  text: string;
  title: string;
  sourceType: SourceType;
  metadata?: Record<string, unknown>;
  file?: { data: Buffer; mimeType: string };
}

/**
 * The one place plain text becomes searchable memory: chunk -> embed -> store.
 * Every ingestion path (CV file upload, a Gmail thread, a calendar event, and
 * later a PR diff or a LinkedIn draft) funnels through this exact function -
 * only the caller supplying `text`/`title`/`sourceType`/`metadata` differs.
 * That's what makes "behave as RAG in some cases" apply uniformly across
 * every module instead of each module reinventing chunk/embed/store.
 */
export async function ingestText(params: IngestTextParams): Promise<IngestResult> {
  const { text, title, sourceType, metadata = {}, file } = params;
  if (!text.trim()) throw new Error(`No text to ingest for "${title}"`);

  const chunks = chunkText(text);
  const embeddings = await embeddingService.embedBatch(chunks);
  const document = await documentRepository.createDocument(title, sourceType, metadata, file); // pass file through

  await documentRepository.insertChunks(
    document.id,
    chunks.map((content, i) => ({ content, embedding: embeddings[i] }))
  );

  return { documentId: document.id, title: document.title, chunkCount: chunks.length };
}