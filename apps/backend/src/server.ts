import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { assertDatabaseConnection } from "./config/database.js";

async function main() {
  await assertDatabaseConnection();
  console.log("✅ connected to Postgres");

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`🚀 backend listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("❌ failed to start server", err);
  process.exit(1);
});
