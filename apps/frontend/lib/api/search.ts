import { apiFetch } from "./client";

export type UnifiedSearchSource = "chat" | "conversation" | "email" | "calendar" | "linkedin" | "documents";

export interface UnifiedSearchHit {
  id: string;
  source: UnifiedSearchSource;
  title: string;
  snippet: string;
  matchedBy: "semantic" | "keyword";
  similarity: number | null;
  createdAt: string;
  role?: "user" | "assistant";
  sessionId?: string;
  sessionTitle?: string;
  metadata?: Record<string, unknown>;
}

export interface UnifiedSearchGroup {
  source: UnifiedSearchSource;
  label: string;
  total: number;
  hits: UnifiedSearchHit[];
}

export interface UnifiedSearchResult {
  query: string;
  tookMs: number;
  highlight: UnifiedSearchGroup | null;
  groups: UnifiedSearchGroup[];
}

/** Search chat history + documents + synced emails/events/posts in one query. */
export function unifiedSearch(query: string, limit = 8): Promise<UnifiedSearchResult> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiFetch<UnifiedSearchResult>(`/search?${params.toString()}`);
}

/** Source-consistent metadata for rendering a group icon/label in the UI. */
export const SOURCE_META: Record<
  UnifiedSearchSource,
  { label: string; description: string }
> = {
  chat: { label: "Chat", description: "Messages from your conversations" },
  conversation: { label: "Chat", description: "Remembered conversation context" },
  email: { label: "Emails", description: "Synced Gmail messages" },
  calendar: { label: "Calendar", description: "Synced Google Calendar events" },
  linkedin: { label: "LinkedIn", description: "Your posts and drafts" },
  documents: { label: "Documents", description: "Uploaded files and knowledge base" },
};