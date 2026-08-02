import { Pool } from "pg";
import { env } from "./env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5, // this process only ever does small point-lookups, so a small pool is enough
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[mcp-gmail-calendar] unexpected Postgres error", err);
});