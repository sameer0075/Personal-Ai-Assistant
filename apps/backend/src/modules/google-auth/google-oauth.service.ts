import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { googleCredentialsRepository } from "./google-credentials.repository.js";
import { signOAuthState, verifyOAuthState } from "../auth/oauth-state.js";

const OAUTH_STATE_PURPOSE = "google_oauth";

export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

function createOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
  });
}

export function buildGoogleConsentUrl(userId: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state: signOAuthState(userId, OAUTH_STATE_PURPOSE),
  });
}

/**
 * The email is read with a local, unverified JWT decode (jwt.decode) rather
 * than google-auth-library's verifyIdToken. verifyIdToken fetches Google's
 * public certs over the network to cryptographically re-check the token's
 * signature - necessary when an ID token arrives from an untrusted source
 * (e.g. a browser-side Google Sign-In button), but redundant here: this
 * token came back from a direct server-to-server HTTPS call to Google's own
 * token endpoint (client.getToken(code) above), so only Google could have
 * produced it - there's nothing left to verify, only a client-facing email
 * to read out for display. Skipping that extra network round trip also
 * means a transient DNS/connectivity hiccup reaching Google's cert endpoint
 * can no longer fail the whole "connect Google" flow after the tokens
 * themselves were already successfully issued.
 */
export async function handleGoogleOAuthCallback(code: string, state: string | undefined): Promise<{ email: string | null }> {
  const userId = verifyOAuthState(state, OAUTH_STATE_PURPOSE);

  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke the app's access at https://myaccount.google.com/permissions and try connecting again."
    );
  }

  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const payload = jwt.decode(tokens.id_token) as { email?: string } | null;
      email = payload?.email ?? null;
    } catch (err) {
      console.warn("Could not decode Google ID token for display email; continuing without it.", err);
    }
  }

  const grantedScopes = typeof tokens.scope === "string" ? tokens.scope.split(" ") : GOOGLE_SCOPES;
  await googleCredentialsRepository.upsert(userId, tokens.refresh_token, email, grantedScopes);

  return { email };
}