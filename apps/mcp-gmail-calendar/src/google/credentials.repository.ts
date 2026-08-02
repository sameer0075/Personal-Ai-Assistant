import { pool } from "../config/database.js";
import { env } from "../config/env.js";
import { decryptSecret } from "../security/token-crypto.js";

const USER_LABEL = "default"; // matches apps/backend's google-credentials.repository.ts

/**
 * Throws a clear, user-actionable error (surfaced back through the MCP tool
 * result) rather than a raw DB/decryption error, since this is the first
 * thing every Gmail/Calendar tool call depends on.
 */
export async function getStoredRefreshToken(): Promise<string> {
  const { rows } = await pool.query<{ refresh_token_encrypted: string }>(
    `SELECT refresh_token_encrypted FROM google_credentials WHERE user_label = $1`,
    [USER_LABEL]
  );

  if (!rows[0]) {
    throw new Error(
      "No Google account is connected yet. Ask the user to connect their Google account first (Settings -> Integrations)."
    );
  }

  return decryptSecret(rows[0].refresh_token_encrypted, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
}