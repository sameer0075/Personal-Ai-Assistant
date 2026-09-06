import { pool } from "../config/database.js";
import { encryptSecret, decryptSecret } from "../security/token-crypto.js";
import { env } from "../config/env.js";

/**
 * Read-side access to the user's stored GitHub credential - written by
 * apps/backend's github-auth module and shared through the same database the
 * backend writes credentials into (the backend injects its DATABASE_URL into
 * this process, so the DB here matches the backend's by construction).
 */
export const githubCredentialsRepository = {
  async getEncryptedToken(userId: string): Promise<string | null> {
    const { rows } = await pool.query<{ github_token_encrypted: string }>(
      `SELECT github_token_encrypted FROM github_credentials WHERE user_id = $1`,
      [userId]
    );
    return rows[0]?.github_token_encrypted ?? null;
  },

  /** The live PAT, or null when this user has no GitHub account connected. */
  async getValidToken(userId: string): Promise<string | null> {
    const encrypted = await this.getEncryptedToken(userId);
    if (!encrypted) return null;
    return decryptSecret(encrypted, env.GITHUB_TOKEN_ENCRYPTION_KEY);
  },

  async storeToken(userId: string, githubLogin: string, token: string): Promise<void> {
    const encrypted = encryptSecret(token, env.GITHUB_TOKEN_ENCRYPTION_KEY);
    await pool.query(
      `INSERT INTO github_credentials (user_id, github_login, github_token_encrypted, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         github_login = EXCLUDED.github_login,
         github_token_encrypted = EXCLUDED.github_token_encrypted,
         updated_at = now()`,
      [userId, githubLogin, encrypted]
    );
  },
};