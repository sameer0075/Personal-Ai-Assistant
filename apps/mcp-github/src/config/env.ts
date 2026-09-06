import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
loadDotenv({ path: envPath });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GITHUB_TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, "GITHUB_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes) - must match apps/backend's value"),
  GITHUB_API_VERSION: z.string().default("2022-11-28"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ [mcp-github] invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;