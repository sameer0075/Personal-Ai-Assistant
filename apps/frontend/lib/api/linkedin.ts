import { apiFetch, apiJson } from "./client";
import type { SyncSummary } from "./gmail";

export interface LinkedinPost {
  postUrn: string;
  commentary: string;
  publishedAt: string;
}

export function createLinkedinPost(commentary: string): Promise<{ published: boolean; postUrn: string }> {
  return apiJson("/linkedin/posts", "POST", { commentary });
}

export function listLinkedinPosts(maxResults = 20): Promise<LinkedinPost[]> {
  return apiFetch<LinkedinPost[]>(`/linkedin/posts?maxResults=${maxResults}`);
}

export function deleteLinkedinPost(postUrn: string): Promise<void> {
  return apiJson<void>(`/linkedin/posts/${encodeURIComponent(postUrn)}`, "DELETE");
}

export function syncLinkedinToRag(maxResults = 20): Promise<SyncSummary> {
  return apiJson<SyncSummary>("/linkedin/sync-to-rag", "POST", { maxResults });
}