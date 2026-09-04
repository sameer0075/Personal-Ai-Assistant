import { embeddingService } from "../embeddings/embedding.service.js";
import { documentRepository } from "./document.repository.js";
import type { RetrievedChunk } from "../../types/index.js";

export async function retrieveRelevantChunks(userId: string, query: string, topK?: number): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embeddingService.embed(query);
  return documentRepository.searchSimilarChunks(userId, queryEmbedding, topK);
}