import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";
import { encryptSecret, decryptSecret } from "../../security/token-crypto.js";

export interface GoogleConnectionStatus {
  connected: boolean;
  googleEmail: string | null;
  grantedScopes: string[];
}

export const googleCredentialsRepository = {
  async upsert(userId: string, refreshToken: string, googleEmail: string | null, scopes: string[]): Promise<void> {
    const encrypted = encryptSecret(refreshToken, env.GOOGLE_TOKEN_ENCRYPTION_KEY);

    await pool.query(
      `INSERT INTO google_credentials (user_id, google_email, refresh_token_encrypted, granted_scopes, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         google_email = EXCLUDED.google_email,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         granted_scopes = EXCLUDED.granted_scopes,
         updated_at = now()`,
      [userId, googleEmail, encrypted, scopes]
    );
  },

  async getDecryptedRefreshToken(userId: string): Promise<string | null> {
    const { rows } = await pool.query<{ refresh_token_encrypted: string }>(
      `SELECT refresh_token_encrypted FROM google_credentials WHERE user_id = $1`,
      [userId]
    );
    if (!rows[0]) return null;
    return decryptSecret(rows[0].refresh_token_encrypted, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  },

  async getStatus(userId: string): Promise<GoogleConnectionStatus> {
    const { rows } = await pool.query<{ google_email: string | null; granted_scopes: string[] }>(
      `SELECT google_email, granted_scopes FROM google_credentials WHERE user_id = $1`,
      [userId]
    );
    if (!rows[0]) return { connected: false, googleEmail: null, grantedScopes: [] };
    return { connected: true, googleEmail: rows[0].google_email, grantedScopes: rows[0].granted_scopes };
  },

  async disconnect(userId: string): Promise<void> {
    await pool.query(`DELETE FROM google_credentials WHERE user_id = $1`, [userId]);
  },
};