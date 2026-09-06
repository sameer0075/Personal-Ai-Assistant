import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";
import { encryptSecret, decryptSecret } from "../../security/token-crypto.js";

export interface GithubConnectionStatus {
  connected: boolean;
  login: string | null;
  email: string | null;
}

/**
 * Write-side access to github_credentials. Tokens are AES-encrypted with
 * GITHUB_TOKEN_ENCRYPTION_KEY - the same key apps/mcp-github/.env carries, so
 * the MCP server (which does the actual GitHub API work) can decrypt it back.
 * Never a plaintext PAT at rest, and never returned by any backend route.
 */
export const githubCredentialsRepository = {
  /** Encrypts and stores a PAT, keeping the placeholder login until it's validated. */
  async storePlaintextToken(userId: string, token: string): Promise<void> {
    const encrypted = encryptSecret(token, env.GITHUB_TOKEN_ENCRYPTION_KEY);
    await pool.query(
      `INSERT INTO github_credentials (user_id, github_login, github_token_encrypted, updated_at)
       VALUES ($1, '', $2, now())
       ON CONFLICT (user_id)
       DO UPDATE SET github_token_encrypted = EXCLUDED.github_token_encrypted, updated_at = now()`,
      [userId, encrypted]
    );
  },

  async updateAccount(userId: string, login: string, email: string | null): Promise<void> {
    await pool.query(
      `UPDATE github_credentials SET github_login = $2, github_email = $3, updated_at = now() WHERE user_id = $1`,
      [userId, login, email]
    );
  },

  async getStatus(userId: string): Promise<GithubConnectionStatus> {
    const { rows } = await pool.query<{ github_login: string | null; github_email: string | null }>(
      `SELECT github_login, github_email FROM github_credentials WHERE user_id = $1`,
      [userId]
    );
    if (!rows[0]?.github_login) return { connected: false, login: null, email: null };
    return { connected: true, login: rows[0].github_login, email: rows[0].github_email };
  },

  async hasToken(userId: string): Promise<boolean> {
    const { rows } = await pool.query<{ github_token_encrypted: string | null }>(
      `SELECT github_token_encrypted FROM github_credentials WHERE user_id = $1`,
      [userId]
    );
    return Boolean(rows[0]?.github_token_encrypted);
  },

  async disconnect(userId: string): Promise<void> {
    await pool.query(`DELETE FROM github_credentials WHERE user_id = $1`, [userId]);
  },

  /** Decrypts a stored PAT - used by the connect flow to confirm the new token is live via the MCP server. */
  async getDecryptedToken(userId: string): Promise<string | null> {
    const { rows } = await pool.query<{ github_token_encrypted: string }>(
      `SELECT github_token_encrypted FROM github_credentials WHERE user_id = $1`,
      [userId]
    );
    if (!rows[0]) return null;
    return decryptSecret(rows[0].github_token_encrypted, env.GITHUB_TOKEN_ENCRYPTION_KEY);
  },
};