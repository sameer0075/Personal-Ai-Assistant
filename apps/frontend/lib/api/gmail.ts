import { apiFetch, apiJson } from "./client";

export interface GmailMessageSummary {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface GmailMessageFull extends GmailMessageSummary {
  to: string;
  body: string;
}

export interface SyncSummary {
  found: number;
  ingested: number;
  skipped: number;
}

export function listGmailMessages(params: { query?: string; maxResults?: number } = {}): Promise<GmailMessageSummary[]> {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.maxResults) search.set("maxResults", String(params.maxResults));
  const qs = search.toString();

  return apiFetch<GmailMessageSummary[]>(`/gmail/messages${qs ? `?${qs}` : ""}`);
}

export function getGmailMessage(id: string): Promise<GmailMessageFull> {
  return apiFetch<GmailMessageFull>(`/gmail/messages/${id}`);
}

export function sendGmailMessage(input: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}): Promise<{ sent: boolean; id: string; threadId: string }> {
  return apiJson("/gmail/send", "POST", input);
}

export function syncGmailToRag(input: { query?: string; maxResults?: number } = {}): Promise<SyncSummary> {
  return apiJson<SyncSummary>("/gmail/sync-to-rag", "POST", input);
}