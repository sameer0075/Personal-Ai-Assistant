import { env } from "../../config/env.js";
import { linkedinCredentialsRepository } from "./linkedin-credentials.repository.js";

/**
 * Scopes requested at consent time:
 * - openid + profile: required to identify which member is authorizing (via
 *   the OpenID Connect userinfo endpoint below) so we can build their Person URN.
 * - email: not strictly needed for posting, but harmless and lets the UI show
 *   which account is connected.
 * - w_member_social: the only scope that actually allows creating/deleting posts.
 *
 * Deliberately NOT requested: r_member_social (reading post history) - it's a
 * restricted permission LinkedIn only grants to specially-approved apps, so we
 * don't rely on it. See ingest-external.service.ts / linkedin_list_recent_posts
 * for how "what have I posted" is answered instead (our own local record).
 */
export const LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social"];

const AUTHORIZATION_ENDPOINT = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_ENDPOINT = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_ENDPOINT = "https://api.linkedin.com/v2/userinfo";

export function buildLinkedinConsentUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.LINKEDIN_OAUTH_CLIENT_ID,
    redirect_uri: env.LINKEDIN_OAUTH_REDIRECT_URI,
    scope: LINKEDIN_SCOPES.join(" "),
  });
  return `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

interface LinkedinTokenResponse {
  access_token: string;
  expires_in: number; // seconds
  refresh_token?: string;
  scope?: string;
}

interface LinkedinUserInfo {
  sub: string;
}

/**
 * Exchanges the OAuth callback `code` for tokens, resolves the member's
 * Person URN via the OpenID Connect userinfo endpoint, and persists the
 * (encrypted) access + refresh tokens.
 *
 * Note: `refresh_token` in the response is only present if this app has been
 * granted LinkedIn's "Programmatic Refresh Tokens" access - most apps won't
 * have it by default, in which case the user simply reconnects every ~60 days
 * when the access token expires (see linkedinCredentialsRepository - refresh
 * is nullable for exactly this reason).
 */
export async function handleLinkedinOAuthCallback(code: string): Promise<{ personUrn: string }> {
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.LINKEDIN_OAUTH_REDIRECT_URI,
      client_id: env.LINKEDIN_OAUTH_CLIENT_ID,
      client_secret: env.LINKEDIN_OAUTH_CLIENT_SECRET,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`LinkedIn token exchange failed (${tokenResponse.status}): ${await tokenResponse.text()}`);
  }

  const tokens = (await tokenResponse.json()) as LinkedinTokenResponse;

  const userInfoResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    throw new Error(`Failed to fetch LinkedIn profile (${userInfoResponse.status}): ${await userInfoResponse.text()}`);
  }

  const userInfo = (await userInfoResponse.json()) as LinkedinUserInfo;
  const personUrn = `urn:li:person:${userInfo.sub}`;

  await linkedinCredentialsRepository.upsert({
    personUrn,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scopes: tokens.scope ? tokens.scope.split(" ") : LINKEDIN_SCOPES,
  });

  return { personUrn };
}