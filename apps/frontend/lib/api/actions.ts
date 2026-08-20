import { apiFetch, apiJson } from "./client";

export type PendingActionType = "email" | "linkedin_post";
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

export interface PendingAction {
  id: string;
  type: PendingActionType;
  status: PendingActionStatus;
  payload: EmailActionPayload | LinkedinActionPayload;
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

export function approveAction(
  id: string,
  edits?: Partial<EmailActionPayload & LinkedinActionPayload>
): Promise<PendingAction> {
  return apiJson<PendingAction>(`/actions/${id}/approve`, "POST", edits ?? {});
}

export function rejectAction(id: string): Promise<PendingAction> {
  return apiJson<PendingAction>(`/actions/${id}/reject`, "POST");
}