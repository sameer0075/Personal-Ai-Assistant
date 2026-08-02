import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "../config/database.js";

/**
 * Minimal migration runner: runs every .sql file in ./migrations, in filename
 * order, inside a transaction. Good enough for a solo project; swap for
 * node-pg-migrate or Prisma Migrate if this grows a team.
 */
async function migrate() {
  const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), "utf-8");
      console.log(`▶ running migration: ${file}`);
      await client.query(sql);
    }
    console.log("✅ migrations complete");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("❌ migration failed", err);
  process.exit(1);
});
