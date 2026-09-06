export type SourceType = "cv" | "email" | "pr" | "linkedin" | "calendar" | "general" | "conversation" | "github";
export type PendingActionType = "email" | "linkedin_post" | "github_issue" | "github_comment";
export type PendingActionStatus = "pending" | "approved" | "rejected";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface EmailActionPayload {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  attachCv?: boolean
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCallTrace[] | null;
  pendingActionIds: string[] | null;
  attachments: ChatAttachment[] | null;
  createdAt: string;
}

/**
 * A file attached directly to a chat message - separate from the RAG
 * document pipeline (DocumentRecord/DocumentChunkRecord below). This is
 * scoped to one conversation: its extracted text rides along in the message
 * history so the agent can answer questions about it, but it is never
 * embedded or searched across the wider knowledge base.
 */
export interface ChatAttachment {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  text: string;
  truncated: boolean;
}

export interface LinkedinActionPayload {
  commentary: string;
}

export interface GithubIssueActionPayload {
  /** Repository as "owner/repo". */
  repo: string;
  title: string;
  body: string;
}

export interface GithubCommentActionPayload {
  /** Repository as "owner/repo". */
  repo: string;
  /** Number of the issue or pull request to comment on. */
  issueNumber: number;
  body: string;
}

export interface PendingAction {
  id: string;
  type: PendingActionType;
  status: PendingActionStatus;
  payload: EmailActionPayload | LinkedinActionPayload | GithubIssueActionPayload | GithubCommentActionPayload;
  createdBy: "agent" | "user";
  result: Record<string, unknown> | null;
  createdAt: string;
  decidedAt: string | null;
}
export interface DocumentRecord {
  id: string;
  title: string;
  source_type: SourceType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DocumentChunkRecord {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** A chunk plus its similarity score, as returned by a retrieval query. */
export interface RetrievedChunk extends DocumentChunkRecord {
  similarity: number; // 1 - cosine_distance, higher = more relevant
}

export interface ChatAnswer {
  answer: string;
  sources: Array<{
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
    similarity: number;
  }>;
}

/** One tool invocation the agent made while answering, for UI transparency. */
export interface ToolCallTrace {
  tool: string;
  input: unknown;
  output?: string;
}

/** Response shape for the Module 2+ tool-calling agent (RAG + Gmail + Calendar). */
export interface AssistantAnswer {
  answer: string;
  toolCalls: ToolCallTrace[];
  pendingActions: PendingAction[]
}

// ---------------------------------------------------------------------------
// Unified search (module: search) — one query across chat history, documents,
// and synced emails/events/posts, rather than only the agent's RAG lookup.
// ---------------------------------------------------------------------------

/**
 * The corpora a unified search can surface a hit from. `chat` is direct chat
 * message rows; `conversation` is chat turns that were indexed into RAG and
 * match semantically; the rest map onto RAG chunks (email/calendar/linkedin/
 * documents) plus the local linkedin_posts table.
 */
export type UnifiedSearchSource = "chat" | "conversation" | "email" | "calendar" | "linkedin" | "documents";

export interface UnifiedSearchHit {
  /** Stable id for React keys + dedup (message id, chunk id, or post id). */
  id: string;
  source: UnifiedSearchSource;
  /** Human-friendly display title (chat session title, email subject, doc title…). */
  title: string;
  /** The searchable text this hit matched on (clients truncate/expand). */
  snippet: string;
  /** keyword = literal substring match; semantic = embedding similarity. */
  matchedBy: "semantic" | "keyword";
  /** Cosine similarity for semantic hits, null for keyword hits. */
  similarity: number | null;
  createdAt: string;
  role?: "user" | "assistant";
  sessionId?: string;
  sessionTitle?: string;
  metadata?: Record<string, unknown>;
}

export interface UnifiedSearchGroup {
  source: UnifiedSearchSource;
  /** Section heading, e.g. "Chat" / "Emails". */
  label: string;
  total: number;
  hits: UnifiedSearchHit[];
}

export interface UnifiedSearchResult {
  query: string;
  tookMs: number;
  /** The single strongest group, re-presented up top for at-a-glance answers. */
  highlight: UnifiedSearchGroup | null;
  groups: UnifiedSearchGroup[];
}

/* ---------------------------------- Automations (scheduled tasks) ---------------------------------- */

export type ScheduleKind = "once" | "interval" | "cron";
export type DeliveryMode = "chat" | "email" | "both";

export interface ScheduledTask {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  scheduleKind: ScheduleKind;
  cronExpr: string | null;
  intervalMinutes: number | null;
  timezone: string;
  /** ISO datetime of the next (or only) intended run. */
  triggerAt: string;
  enabled: boolean;
  deliveryMode: DeliveryMode;
  /** Destination email; defaults to the user's connected Gmail when null. */
  emailTo: string | null;
  /** Email subject; defaults to "[Automation: <title>]" when null. */
  emailSubject: string | null;
  deliverToSessionId: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  runCount: number;
  createdAt: string;
}

/** How a run's output is delivered. Email requires a connected Google account. */
export interface DeliveryDefinition {
  mode: DeliveryMode;
  emailTo?: string;
  emailSubject?: string;
}

/** A schedule definition as supplied by the client. */
export interface ScheduleDefinition {
  kind: ScheduleKind;
  /** ISO datetime — required for "once"; optional "start at" for "interval". */
  at?: string;
  intervalMinutes?: number;
  /** 5-field cron expression (minute hour day-of-month month day-of-week). */
  cron?: string;
  /** IANA timezone, e.g. "Asia/Karachi" (default "UTC"). */
  timezone?: string;
}

export interface CreateAutomationInput {
  title: string;
  prompt: string;
  schedule: ScheduleDefinition;
  delivery?: DeliveryDefinition;
  /** Optional chat to deliver results into; defaults to the most recent one. */
  deliverToSessionId?: string;
}

export interface UpdateAutomationInput {
  title?: string;
  prompt?: string;
  schedule?: ScheduleDefinition;
  delivery?: Partial<DeliveryDefinition>;
  deliverToSessionId?: string | null;
  enabled?: boolean;
}