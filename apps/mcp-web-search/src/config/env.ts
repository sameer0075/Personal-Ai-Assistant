import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
loadDotenv({ path: envPath });

const envSchema = z.object({
  TAVILY_API_KEY: z.string().min(1, "TAVILY_API_KEY is required (free at https://app.tavily.com)"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ [mcp-web-search] invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;