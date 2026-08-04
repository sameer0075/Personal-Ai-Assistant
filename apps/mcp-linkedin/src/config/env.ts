import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
loadDotenv({ path: envPath });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LINKEDIN_TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, "LINKEDIN_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes) - must match apps/backend's value"),
  LINKEDIN_OAUTH_CLIENT_ID: z.string().min(1, "LINKEDIN_OAUTH_CLIENT_ID is required"),
  LINKEDIN_OAUTH_CLIENT_SECRET: z.string().min(1, "LINKEDIN_OAUTH_CLIENT_SECRET is required"),
  LINKEDIN_API_VERSION: z.string().default("202607"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ [mcp-linkedin] invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;