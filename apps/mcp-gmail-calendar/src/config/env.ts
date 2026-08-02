import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

/**
 * This process is normally spawned as a child process by the backend (see
 * apps/backend/src/modules/mcp/mcp-client.service.ts), which means its
 * working directory is whatever the backend's is - NOT this package's folder.
 * Loading `.env` by an absolute path computed from this file's own location
 * makes the server's config independent of who starts it or from where.
 */
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
loadDotenv({ path: envPath });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, "GOOGLE_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes) - must match apps/backend's value"),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1, "GOOGLE_OAUTH_CLIENT_ID is required"),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1, "GOOGLE_OAUTH_CLIENT_SECRET is required"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ [mcp-gmail-calendar] invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;