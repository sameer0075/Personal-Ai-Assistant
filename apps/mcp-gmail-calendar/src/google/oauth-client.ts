import { google } from "googleapis";
import { env } from "../config/env.js";
import { getStoredRefreshToken } from "./credentials.repository.js";

/**
 * In-memory cache of the current access token, shared across every
 * Gmail/Calendar tool call in this process.
 *
 * BEFORE: every call built a fresh OAuth2Client with only `refresh_token`
 * set - no access_token, no expiry_date. With nothing cached, googleapis had
 * no choice but to perform a full token exchange against Google's OAuth
 * endpoint (a real network round trip, typically 300-800ms) before *every
 * single* Gmail/Calendar API call, even two calls one second apart in the
 * same agent turn. That round trip is why "tool called -> still slow" was
 * so noticeable specifically for Gmail/Calendar tools.
 *
 * AFTER: the access token (and its expiry) is cached here and reused until
 * it's about to expire, so a burst of tool calls in one turn - or calls
 * across turns within the token's ~1hr lifetime - pays the exchange cost
 * once instead of every time.
 */
interface CachedAccessToken {
  accessToken: string;
  expiryDate: number; // ms since epoch
}

let cachedToken: CachedAccessToken | null = null;
// Coalesces concurrent refreshes (e.g. several tool calls firing back to
// back before the first refresh lands) into a single token exchange.
let refreshInFlight: Promise<CachedAccessToken> | null = null;

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
    // Google typically returns an hour-long token; fall back to 55 minutes
    // if expiry_date is somehow missing rather than treating it as expired.
    expiryDate: credentials.expiry_date ?? Date.now() + 55 * 60_000,
  };
}

/**
 * Returns a ready-to-use, authenticated OAuth2 client. Access tokens are
 * refreshed transparently using the stored refresh token whenever the
 * cached one is missing or expired - callers never need to think about
 * token expiry, and in the common case (token still valid) this does no
 * network I/O at all beyond the DB read for the refresh token.
 *
 * Deliberately built via `google.auth.OAuth2` (googleapis' own re-export)
 * rather than importing the standalone `google-auth-library` package
 * directly: googleapis bundles its own nested copy of that library, and a
 * top-level copy would be a structurally-identical but nominally different
 * TypeScript type, which the `gmail()`/`calendar()` factories below would
 * then reject. Going through `google.auth.OAuth2` guarantees we're always
 * using the exact class those factories expect.
 */
export async function getGoogleAuthClient() {
  const refreshToken = await getStoredRefreshToken();
  const client = buildClient(refreshToken);

  if (cachedToken && cachedToken.expiryDate - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    client.setCredentials({ refresh_token: refreshToken, access_token: cachedToken.accessToken });
    return client;
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(refreshToken)
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  const token = await refreshInFlight;
  client.setCredentials({ refresh_token: refreshToken, access_token: token.accessToken });
  return client;
}