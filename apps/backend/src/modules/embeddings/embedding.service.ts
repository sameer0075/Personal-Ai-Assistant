import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { env } from "../../config/env.js";

/**
 * Generates sentence embeddings 100% locally via transformers.js (ONNX runtime
 * under the hood) - no external API, no per-token cost, no network call at
 * inference time. Model weights are downloaded once and cached on disk.
 *
 * Xenova/all-MiniLM-L6-v2 -> 384-dim vectors, which must match the `vector(384)`
 * column type in the migration and EMBEDDING_DIMENSIONS in .env.
 */
class EmbeddingService {
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipelinePromise) {
      console.log(`⏳ loading embedding model "${env.EMBEDDING_MODEL}" (first call only)...`);
      this.pipelinePromise = pipeline("feature-extraction", env.EMBEDDING_MODEL) as Promise<FeatureExtractionPipeline>;
    }
    return this.pipelinePromise;
  }

  /** Embed a single string. */
  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  /** Embed many strings in one pass (used during CV ingestion). */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const extractor = await this.getPipeline();
    const results: number[][] = [];

    for (const text of texts) {
      const output = await extractor(text, { pooling: "mean", normalize: true });
      results.push(Array.from(output.data as Float32Array));
    }

    return results;
  }
}

// Singleton - the model must only be loaded into memory once per process.
export const embeddingService = new EmbeddingService();
