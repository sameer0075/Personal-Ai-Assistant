import { pool } from "../config/database.js";
import { env } from "../config/env.js";
import { decryptSecret } from "../security/token-crypto.js";

/**
 * Throws a clear, user-actionable error (surfaced back through the MCP tool
 * result) rather than a raw DB/decryption error, since this is the first
 * thing every Gmail/Calendar tool call depends on. Scoped by userId - each
 * Gmail/Calendar tool call carries the id of whichever user's turn is
 * actually running (injected server-side by apps/backend's
 * mcp-tool-adapter.ts, never supplied by the LLM itself), so this always
 * looks up that same user's own connected Google account.
 */
export async function getStoredRefreshToken(userId: string): Promise<string> {
  const { rows } = await pool.query<{ refresh_token_encrypted: string }>(
    `SELECT refresh_token_encrypted FROM google_credentials WHERE user_id = $1`,
    [userId]
  );

  if (!rows[0]) {
    throw new Error(
      "No Google account is connected yet. Ask the user to connect their Google account first (Settings -> Integrations)."
    );
  }

  return decryptSecret(rows[0].refresh_token_encrypted, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
}