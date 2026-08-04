import { Pool } from "pg";
import { env } from "./env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[mcp-linkedin] unexpected Postgres error", err);
});