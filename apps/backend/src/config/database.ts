import { Pool } from "pg";
import { env } from "./env.js";

/**
 * Single shared connection pool for the whole process.
 * Every module that needs the DB imports `pool` from here - no module should
 * create its own `new Pool()`, so we never leak connections across the app.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  // Unexpected errors on idle clients (e.g. DB restarted) - log, don't crash.
  console.error("Unexpected error on idle Postgres client", err);
});

export async function assertDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
