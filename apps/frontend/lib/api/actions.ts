import { apiFetch, apiJson } from "./client";

export type PendingActionType = "email" | "linkedin_post" | "github_issue" | "github_comment";
export type PendingActionStatus = "pending" | "approved" | "rejected";

export interface EmailActionPayload {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  attachCv?: boolean;
}

export interface LinkedinActionPayload {
  commentary: string;
}

export interface GithubIssueActionPayload {
  repo: string;
  title: string;
  body: string;
}

export interface GithubCommentActionPayload {
  repo: string;
  issueNumber: number;
  body: string;
}

export type ActionPayload =
  | EmailActionPayload
  | LinkedinActionPayload
  | GithubIssueActionPayload
  | GithubCommentActionPayload;

export interface PendingAction {
  id: string;
  type: PendingActionType;
  status: PendingActionStatus;
  payload: ActionPayload;
  createdBy: "agent" | "user";
  result: Record<string, unknown> | null;
  createdAt: string;
  decidedAt: string | null;
}

export function listPendingActions(): Promise<PendingAction[]> {
  return apiFetch<PendingAction[]>("/actions/pending");
}

export function createEmailDraft(payload: EmailActionPayload): Promise<PendingAction> {
  return apiJson<PendingAction>("/actions/email/draft", "POST", payload);
}

export function createLinkedinDraft(payload: LinkedinActionPayload): Promise<PendingAction> {
  return apiJson<PendingAction>("/actions/linkedin/draft", "POST", payload);
}

export function createGithubIssueDraft(payload: GithubIssueActionPayload): Promise<PendingAction> {
  return apiJson<PendingAction>("/actions/github/issue/draft", "POST", payload);
}

export function createGithubCommentDraft(payload: GithubCommentActionPayload): Promise<PendingAction> {
  return apiJson<PendingAction>("/actions/github/comment/draft", "POST", payload);
}

export function approveAction(
  id: string,
  edits?: Partial<ActionPayload>
): Promise<PendingAction> {
  return apiJson<PendingAction>(`/actions/${id}/approve`, "POST", edits ?? {});
}

export function rejectAction(id: string): Promise<PendingAction> {
  return apiJson<PendingAction>(`/actions/${id}/reject`, "POST");
}