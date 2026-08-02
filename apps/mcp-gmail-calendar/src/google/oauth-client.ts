import { google } from "googleapis";
import { env } from "../config/env.js";
import { getStoredRefreshToken } from "./credentials.repository.js";

/**
 * Returns a ready-to-use, authenticated OAuth2 client. Access tokens are
 * refreshed transparently using the stored refresh token whenever the
 * current one is missing or expired - callers never need to think about
 * token expiry.
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

  const client = new google.auth.OAuth2({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
  client.setCredentials({ refresh_token: refreshToken });

  return client;
}