import { pendingActionsRepository } from "./pending-actions.repository.js";
import { callMcpTool } from "../mcp/mcp-client.service.js";
import type { EmailActionPayload, LinkedinActionPayload, PendingAction } from "../../types/index.js";

export function createEmailDraft(
  userId: string,
  payload: EmailActionPayload,
  createdBy: "agent" | "user" = "agent"
): Promise<PendingAction> {
  return pendingActionsRepository.create({ userId, type: "email", payload: payload as unknown as Record<string, unknown>, createdBy });
}

export function createLinkedinDraft(
  userId: string,
  payload: LinkedinActionPayload,
  createdBy: "agent" | "user" = "agent"
): Promise<PendingAction> {
  return pendingActionsRepository.create({ userId, type: "linkedin_post", payload: payload as unknown as Record<string, unknown>, createdBy });
}

export function listPendingActions(userId: string): Promise<PendingAction[]> {
  return pendingActionsRepository.listPending(userId);
}

export function getPendingAction(id: string, userId: string): Promise<PendingAction | null> {
  return pendingActionsRepository.findById(id, userId);
}

export async function approvePendingAction(
  id: string,
  userId: string,
  overridePayload?: Record<string, unknown>
): Promise<PendingAction> {
  const existing = await pendingActionsRepository.findById(id, userId);
  if (!existing) throw new Error(`No pending action with id "${id}"`);
  if (existing.status !== "pending") throw new Error(`This action was already ${existing.status} - refresh and try again.`);

  const payload = { ...existing.payload, ...(overridePayload ?? {}) };
  let result: Record<string, unknown>;

  if (existing.type === "email") {
    const { to, subject, body, cc, attachCv } = payload as EmailActionPayload;
    const args: Record<string, unknown> = { to, subject, body, userId };
    if (cc) args.cc = cc;
    if (attachCv) args.attachCv = true;
    const json = await callMcpTool("gmail_send_message", args);
    result = JSON.parse(json);
  } else {
    const { commentary } = payload as LinkedinActionPayload;
    const json = await callMcpTool("linkedin_create_post", { commentary, userId });
    result = JSON.parse(json);
  }

  const updated = await pendingActionsRepository.markDecided(id, userId, "approved", result);
  if (!updated) {
    throw new Error(`"${existing.type}" action was already decided elsewhere, but this request also executed it - please check your Gmail/LinkedIn to avoid a duplicate.`);
  }
  return updated;
}

export async function rejectPendingAction(id: string, userId: string): Promise<PendingAction> {
  const updated = await pendingActionsRepository.markDecided(id, userId, "rejected");
  if (!updated) throw new Error(`No pending action with id "${id}", or it was already decided.`);
  return updated;
}