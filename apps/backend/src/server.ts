import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { assertDatabaseConnection } from "./config/database.js";
import { embeddingService } from "./modules/embeddings/embedding.service.js";

async function main() {
  // Run in parallel with the DB check - the embedding model load (first-run
  // download + ONNX session init) can take a few seconds, and doing it now
  // means the first real chat turn that touches RAG isn't the one that pays
  // for it.
  const [dbResult, warmUpResult] = await Promise.allSettled([
    assertDatabaseConnection(),
    embeddingService.warmUp(),
  ]);
  if (dbResult.status === "rejected") throw dbResult.reason;
  console.log("✅ connected to Postgres");
  if (warmUpResult.status === "fulfilled") {
    console.log("✅ embedding model warmed up");
  } else {
    console.error("⚠️  embedding model warm-up failed (will retry lazily on first use):", warmUpResult.reason);
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`🚀 backend listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("❌ failed to start server", err);
  process.exit(1);
});