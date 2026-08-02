import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";
import { encryptSecret, decryptSecret } from "../../security/token-crypto.js";

export interface GoogleConnectionStatus {
  connected: boolean;
  googleEmail: string | null;
  grantedScopes: string[];
}

const USER_LABEL = "default"; // single-user app for now - see migration comment

export const googleCredentialsRepository = {
  async upsert(refreshToken: string, googleEmail: string | null, scopes: string[]): Promise<void> {
    const encrypted = encryptSecret(refreshToken, env.GOOGLE_TOKEN_ENCRYPTION_KEY);

    await pool.query(
      `INSERT INTO google_credentials (user_label, google_email, refresh_token_encrypted, granted_scopes, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_label)
       DO UPDATE SET
         google_email = EXCLUDED.google_email,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         granted_scopes = EXCLUDED.granted_scopes,
         updated_at = now()`,
      [USER_LABEL, googleEmail, encrypted, scopes]
    );
  },

  async getDecryptedRefreshToken(): Promise<string | null> {
    const { rows } = await pool.query<{ refresh_token_encrypted: string }>(
      `SELECT refresh_token_encrypted FROM google_credentials WHERE user_label = $1`,
      [USER_LABEL]
    );
    if (!rows[0]) return null;
    return decryptSecret(rows[0].refresh_token_encrypted, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  },

  async getStatus(): Promise<GoogleConnectionStatus> {
    const { rows } = await pool.query<{ google_email: string | null; granted_scopes: string[] }>(
      `SELECT google_email, granted_scopes FROM google_credentials WHERE user_label = $1`,
      [USER_LABEL]
    );
    if (!rows[0]) return { connected: false, googleEmail: null, grantedScopes: [] };
    return { connected: true, googleEmail: rows[0].google_email, grantedScopes: rows[0].granted_scopes };
  },

  async disconnect(): Promise<void> {
    await pool.query(`DELETE FROM google_credentials WHERE user_label = $1`, [USER_LABEL]);
  },
};