import { apiFetch, apiJson } from "./client";

export interface LinkedinStatus {
  connected: boolean;
  personUrn: string | null;
  grantedScopes: string[];
  expiresAt: string | null;
}

export function getLinkedinAuthUrl(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/linkedin/auth-url");
}

export function getLinkedinStatus(): Promise<LinkedinStatus> {
  return apiFetch<LinkedinStatus>("/linkedin/status");
}

export function disconnectLinkedin(): Promise<void> {
  return apiJson<void>("/linkedin/disconnect", "POST");
}