import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { env } from "../../config/env.js";

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

  /**
   * Embed many strings in one pass (used during CV ingestion, and for
   * conversation-recall indexing after every chat turn).
   *
   * Previously this looped and awaited the extractor once per text, so N
   * chunks meant N sequential ONNX runs. transformers.js pipelines accept an
   * array directly and batch the forward pass, which is meaningfully faster
   * for multi-chunk documents - the difference shows up as ingestion (and
   * therefore each chat turn's fire-and-forget recall indexing) finishing
   * faster and freeing up the event loop sooner.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.getPipeline();
    const output = await extractor(texts, { pooling: "mean", normalize: true });

    // Batched output is a single tensor of shape [texts.length, dim] -
    // `tolist()` gives us back one array per input string.
    return (output.tolist() as number[][]).map((vector) => vector);
  }

  warmUp(): Promise<FeatureExtractionPipeline> {
    return this.getPipeline();
  }
}

export const embeddingService = new EmbeddingService();