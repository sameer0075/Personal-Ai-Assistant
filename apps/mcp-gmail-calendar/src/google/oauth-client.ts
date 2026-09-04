import { google } from "googleapis";
import { env } from "../config/env.js";
import { getStoredRefreshToken } from "./credentials.repository.js";

interface CachedAccessToken {
  accessToken: string;
  expiryDate: number; // ms since epoch
}

const tokenCache = new Map<string, CachedAccessToken>();
const refreshesInFlight = new Map<string, Promise<CachedAccessToken>>();

const EXPIRY_SAFETY_MARGIN_MS = 60_000; // refresh a minute early rather than right at the edge

function buildClient(refreshToken: string) {
  const client = new google.auth.OAuth2({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

async function refreshAccessToken(refreshToken: string): Promise<CachedAccessToken> {
  const client = buildClient(refreshToken);
  const { credentials } = await client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Google token refresh succeeded but returned no access_token");
  }

  return {
    accessToken: credentials.access_token,
    expiryDate: credentials.expiry_date ?? Date.now() + 55 * 60_000,
  };
}

export async function getGoogleAuthClient(userId: string) {
  const refreshToken = await getStoredRefreshToken(userId);
  const client = buildClient(refreshToken);

  const cached = tokenCache.get(userId);
  if (cached && cached.expiryDate - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    client.setCredentials({ refresh_token: refreshToken, access_token: cached.accessToken });
    return client;
  }

  let refreshPromise = refreshesInFlight.get(userId);
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(refreshToken)
      .then((token) => {
        tokenCache.set(userId, token);
        return token;
      })
      .finally(() => {
        refreshesInFlight.delete(userId);
      });
    refreshesInFlight.set(userId, refreshPromise);
  }

  const token = await refreshPromise;
  client.setCredentials({ refresh_token: refreshToken, access_token: token.accessToken });
  return client;
}