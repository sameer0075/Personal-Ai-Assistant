import { apiFetch, apiJson } from "./client";

export interface GithubStatus {
  connected: boolean;
  login: string | null;
  email: string | null;
}

export interface GithubSyncResult {
  found: number;
  ingested: number;
  skipped: number;
  repos: number;
}

export function getGithubStatus(): Promise<GithubStatus> {
  return apiFetch<GithubStatus>("/github");
}

export function connectGithub(token: string): Promise<GithubStatus> {
  return apiJson<GithubStatus>("/github/connect", "POST", { token });
}

export function disconnectGithub(): Promise<void> {
  return apiJson<void>("/github", "DELETE");
}

export function syncGithub(): Promise<GithubSyncResult> {
  return apiJson<GithubSyncResult>("/github/sync", "POST");
}