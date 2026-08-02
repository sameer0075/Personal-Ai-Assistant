import { apiFetch, apiJson } from "./client";

export interface GoogleStatus {
  connected: boolean;
  googleEmail: string | null;
  grantedScopes: string[];
}

export function getGoogleAuthUrl(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/google/auth-url");
}

export function getGoogleStatus(): Promise<GoogleStatus> {
  return apiFetch<GoogleStatus>("/google/status");
}

export function disconnectGoogle(): Promise<void> {
  return apiJson<void>("/google/disconnect", "POST");
}