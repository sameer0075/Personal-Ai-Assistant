import { pendingActionsRepository } from "./pending-actions.repository.js";
import { callMcpTool } from "../mcp/mcp-client.service.js";
import type {
  EmailActionPayload,
  LinkedinActionPayload,
  PendingAction,
} from "../../types/index.js";

export function createEmailDraft(
  payload: EmailActionPayload,
  createdBy: "agent" | "user" = "agent"
): Promise<PendingAction> {
  return pendingActionsRepository.create({
    type: "email",
    payload: payload as unknown as Record<string, unknown>,
    createdBy,
  });
}

export function createLinkedinDraft(
  payload: LinkedinActionPayload,
  createdBy: "agent" | "user" = "agent"
): Promise<PendingAction> {
  return pendingActionsRepository.create({
    type: "linkedin_post",
    payload: payload as unknown as Record<string, unknown>,
    createdBy,
  });
}

export function listPendingActions(): Promise<PendingAction[]> {
  return pendingActionsRepository.listPending();
}

export function getPendingAction(id: string): Promise<PendingAction | null> {
  return pendingActionsRepository.findById(id);
}

/**
 * The ONLY function in the whole app that actually sends a Gmail message or
 * publishes a LinkedIn post. Only called from POST /api/actions/:id/approve,
 * i.e. only after a human clicked "Approve" in the review modal.
 */
export async function approvePendingAction(
  id: string,
  overridePayload?: Record<string, unknown>
): Promise<PendingAction> {
  const existing = await pendingActionsRepository.findById(id);
  if (!existing) {
    throw new Error(`No pending action with id "${id}"`);
  }
  if (existing.status !== "pending") {
    throw new Error(`This action was already ${existing.status} - refresh and try again.`);
  }

  const payload = { ...existing.payload, ...(overridePayload ?? {}) };
  let result: Record<string, unknown>;

   if (existing.type === "email") {
    const { to, subject, body, cc, attachCv } = payload as EmailActionPayload;
    const args: Record<string, unknown> = { to, subject, body };
    if (cc) args.cc = cc;
    if (attachCv) args.attachCv = true;
    const json = await callMcpTool("gmail_send_message", args);
    result = JSON.parse(json);
  } else {
    const { commentary } = payload as LinkedinActionPayload;
    const json = await callMcpTool("linkedin_create_post", { commentary });
    result = JSON.parse(json);
  }

  const updated = await pendingActionsRepository.markDecided(id, "approved", result);
  if (!updated) {
    throw new Error(
      `"${existing.type}" action was already decided elsewhere, but this request also executed it - please check your Gmail/LinkedIn to avoid a duplicate.`
    );
  }
  return updated;
}

/** Discards a draft. No Gmail/LinkedIn call is ever made for a rejected action. */
export async function rejectPendingAction(id: string): Promise<PendingAction> {
  const updated = await pendingActionsRepository.markDecided(id, "rejected");
  if (!updated) {
    throw new Error(`No pending action with id "${id}", or it was already decided.`);
  }
  return updated;
}