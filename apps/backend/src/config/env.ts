import "dotenv/config";
import { z } from "zod";

/**
 * Every environment variable the backend depends on is declared and validated
 * here, once. Nothing else in the codebase should read `process.env` directly -
 * that keeps config typo-safe and makes it obvious what the service needs to run.
 */
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required (free key at aistudio.google.com/apikey)"),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-lite"),

  EMBEDDING_MODEL: z.string().default("Xenova/all-MiniLM-L6-v2"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(384),

  CHUNK_SIZE: z.coerce.number().default(800),
  CHUNK_OVERLAP: z.coerce.number().default(120),
  RAG_TOP_K: z.coerce.number().default(5),

  // --- Google OAuth (Gmail + Calendar) ---
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1, "GOOGLE_OAUTH_CLIENT_ID is required"),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1, "GOOGLE_OAUTH_CLIENT_SECRET is required"),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().default("http://localhost:4000/api/google/callback"),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64, "GOOGLE_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"),
  FRONTEND_BASE_URL: z.string().default("http://localhost:3000"),

  // --- MCP server (Gmail/Calendar tool provider) ---
  // How the backend spawns the MCP server as a child process over stdio.
  MCP_SERVER_COMMAND: z.string().default("npx"),
  MCP_SERVER_ARGS: z.string().default("tsx ../mcp-gmail-calendar/src/server.ts"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
