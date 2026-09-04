import { pool } from "../config/database.js";
import { env } from "../config/env.js";
import { encryptSecret, decryptSecret } from "../security/token-crypto.js";

const TOKEN_ENDPOINT = "https://www.linkedin.com/oauth/v2/accessToken";
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // refresh a little early rather than right at the edge

interface StoredCredentials {
  person_urn: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  expires_at: string;
}

interface RefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function loadStoredCredentials(userId: string): Promise<StoredCredentials> {
  const { rows } = await pool.query<StoredCredentials>(
    `SELECT person_urn, access_token_encrypted, refresh_token_encrypted, expires_at
     FROM linkedin_credentials WHERE user_id = $1`,
    [userId]
  );

  if (!rows[0]) {
    throw new Error(
      "No LinkedIn account is connected yet. Ask the user to connect their LinkedIn account first (Settings -> Integrations)."
    );
  }

  return rows[0];
}

async function refreshAccessToken(userId: string, refreshTokenEncrypted: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const refreshToken = decryptSecret(refreshTokenEncrypted, env.LINKEDIN_TOKEN_ENCRYPTION_KEY);

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.LINKEDIN_OAUTH_CLIENT_ID,
      client_secret: env.LINKEDIN_OAUTH_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `LinkedIn token refresh failed (${response.status}). The user likely needs to reconnect their LinkedIn account.`
    );
  }

  const data = (await response.json()) as RefreshResponse;
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  const accessTokenEncrypted = encryptSecret(data.access_token, env.LINKEDIN_TOKEN_ENCRYPTION_KEY);
  const newRefreshTokenEncrypted = data.refresh_token
    ? encryptSecret(data.refresh_token, env.LINKEDIN_TOKEN_ENCRYPTION_KEY)
    : null;

  await pool.query(
    `UPDATE linkedin_credentials
     SET access_token_encrypted = $1,
         refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
         expires_at = $3,
         updated_at = now()
     WHERE user_id = $4`,
    [accessTokenEncrypted, newRefreshTokenEncrypted, expiresAt, userId]
  );

  return { accessToken: data.access_token, expiresAt };
}

interface CachedCredentials {
  accessToken: string;
  personUrn: string;
  expiresAtMs: number;
}

const credentialsCache = new Map<string, CachedCredentials>();
const inFlightRefreshes = new Map<string, Promise<{ accessToken: string; personUrn: string }>>();

/**
 * Returns a valid access token + the user's Person URN, refreshing the token
 * first if it's expired (or about to be) and a refresh token is available.
 * Scoped by userId to ensure complete multi-user isolation.
 */
export async function getValidLinkedinCredentials(userId: string): Promise<{ accessToken: string; personUrn: string }> {
  const cached = credentialsCache.get(userId);
  if (cached && Date.now() < cached.expiresAtMs - EXPIRY_BUFFER_MS) {
    return { accessToken: cached.accessToken, personUrn: cached.personUrn };
  }

  let inFlight = inFlightRefreshes.get(userId);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const stored = await loadStoredCredentials(userId);
    const expiresAtMs = new Date(stored.expires_at).getTime();

    if (Date.now() < expiresAtMs - EXPIRY_BUFFER_MS) {
      const creds = {
        accessToken: decryptSecret(stored.access_token_encrypted, env.LINKEDIN_TOKEN_ENCRYPTION_KEY),
        personUrn: stored.person_urn,
        expiresAtMs,
      };
      credentialsCache.set(userId, creds);
      return { accessToken: creds.accessToken, personUrn: creds.personUrn };
    }

    if (!stored.refresh_token_encrypted) {
      throw new Error(
        "The connected LinkedIn account's access token has expired and this app doesn't have refresh-token access. Ask the user to reconnect their LinkedIn account (Settings -> Integrations)."
      );
    }

    const refreshed = await refreshAccessToken(userId, stored.refresh_token_encrypted);
    const creds = {
      accessToken: refreshed.accessToken,
      personUrn: stored.person_urn,
      expiresAtMs: refreshed.expiresAt.getTime(),
    };
    credentialsCache.set(userId, creds);
    return { accessToken: creds.accessToken, personUrn: creds.personUrn };
  })().finally(() => {
    inFlightRefreshes.delete(userId);
  });

  inFlightRefreshes.set(userId, inFlight);
  return inFlight;
}