export type SourceType = "cv" | "email" | "pr" | "linkedin" | "calendar" | "general";

export interface DocumentRecord {
  id: string;
  title: string;
  source_type: SourceType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DocumentChunkRecord {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** A chunk plus its similarity score, as returned by a retrieval query. */
export interface RetrievedChunk extends DocumentChunkRecord {
  similarity: number; // 1 - cosine_distance, higher = more relevant
}

export interface ChatAnswer {
  answer: string;
  sources: Array<{
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
    similarity: number;
  }>;
}

/** One tool invocation the agent made while answering, for UI transparency. */
export interface ToolCallTrace {
  tool: string;
  input: unknown;
  output?: string;
}

/** Response shape for the Module 2+ tool-calling agent (RAG + Gmail + Calendar). */
export interface AssistantAnswer {
  answer: string;
  toolCalls: ToolCallTrace[];
}