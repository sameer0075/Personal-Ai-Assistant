import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";
import { googleCredentialsRepository } from "./google-credentials.repository.js";

/**
 * Scopes requested at consent time. Kept minimal-but-sufficient:
 * - gmail.readonly + gmail.send: read + send mail, but NOT gmail.modify
 *   (no ability to delete mail or alter labels) - the assistant shouldn't
 *   need more than that to do what you described.
 * - calendar.events: create/update/delete events on calendars the user owns.
 * - calendar.readonly: list events across all the user's calendars.
 * - userinfo.email + openid: only enough to show which Google account is connected.
 */
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

/** Builds the URL the frontend redirects the user to for Google consent. */
export function buildGoogleConsentUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // forces refresh_token on every connect, even for a returning user
    scope: GOOGLE_SCOPES,
  });
}

/**
 * Exchanges the OAuth callback `code` for tokens, pulls the connected email
 * out of the ID token, and persists the (encrypted) refresh token.
 * Throws if Google didn't return a refresh_token - this happens if the user
 * previously granted consent and Google decided not to re-issue one; asking
 * with `prompt: "consent"` (above) avoids that in the normal case.
 */
export async function handleGoogleOAuthCallback(code: string): Promise<{ email: string | null }> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke the app's access at https://myaccount.google.com/permissions and try connecting again."
    );
  }

  let email: string | null = null;
  if (tokens.id_token) {
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_OAUTH_CLIENT_ID });
    email = ticket.getPayload()?.email ?? null;
  }

  const grantedScopes = typeof tokens.scope === "string" ? tokens.scope.split(" ") : GOOGLE_SCOPES;
  await googleCredentialsRepository.upsert(tokens.refresh_token, email, grantedScopes);

  return { email };
}