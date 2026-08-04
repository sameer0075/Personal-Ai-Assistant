import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";
import { encryptSecret } from "../../security/token-crypto.js";

export interface LinkedinConnectionStatus {
  connected: boolean;
  personUrn: string | null;
  grantedScopes: string[];
  expiresAt: string | null;
}

const USER_LABEL = "default"; // single-user app for now - see migration comment

export const linkedinCredentialsRepository = {
  async upsert(params: {
    personUrn: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date;
    scopes: string[];
  }): Promise<void> {
    const accessEncrypted = encryptSecret(params.accessToken, env.LINKEDIN_TOKEN_ENCRYPTION_KEY);
    const refreshEncrypted = params.refreshToken
      ? encryptSecret(params.refreshToken, env.LINKEDIN_TOKEN_ENCRYPTION_KEY)
      : null;

    await pool.query(
      `INSERT INTO linkedin_credentials
         (user_label, person_urn, access_token_encrypted, refresh_token_encrypted, expires_at, granted_scopes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (user_label)
       DO UPDATE SET
         person_urn = EXCLUDED.person_urn,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         expires_at = EXCLUDED.expires_at,
         granted_scopes = EXCLUDED.granted_scopes,
         updated_at = now()`,
      [USER_LABEL, params.personUrn, accessEncrypted, refreshEncrypted, params.expiresAt, params.scopes]
    );
  },

  async getStatus(): Promise<LinkedinConnectionStatus> {
    const { rows } = await pool.query<{ person_urn: string; granted_scopes: string[]; expires_at: string }>(
      `SELECT person_urn, granted_scopes, expires_at FROM linkedin_credentials WHERE user_label = $1`,
      [USER_LABEL]
    );
    if (!rows[0]) return { connected: false, personUrn: null, grantedScopes: [], expiresAt: null };
    return {
      connected: true,
      personUrn: rows[0].person_urn,
      grantedScopes: rows[0].granted_scopes,
      expiresAt: rows[0].expires_at,
    };
  },

  async disconnect(): Promise<void> {
    await pool.query(`DELETE FROM linkedin_credentials WHERE user_label = $1`, [USER_LABEL]);
  },
};