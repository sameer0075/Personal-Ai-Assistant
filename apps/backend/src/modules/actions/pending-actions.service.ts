import { pendingActionsRepository } from "./pending-actions.repository.js";
import { callMcpTool } from "../mcp/mcp-client.service.js";
import { pool } from "../../config/database.js";
import type {
  EmailActionPayload,
  GithubCommentActionPayload,
  GithubIssueActionPayload,
  HrEventInvitePayload,
  LinkedinActionPayload,
  PendingAction,
} from "../../types/index.js";

export function createEmailDraft(
  userId: string,
  workspaceId: string,
  payload: EmailActionPayload,
  createdBy: "agent" | "user" = "agent"
): Promise<PendingAction> {
  return pendingActionsRepository.create({ userId, workspaceId, type: "email", payload: payload as unknown as Record<string, unknown>, createdBy });
}

export function createLinkedinDraft(
  userId: string,
  workspaceId: string,
  payload: LinkedinActionPayload,
  createdBy: "agent" | "user" = "agent"
): Promise<PendingAction> {
  return pendingActionsRepository.create({ userId, workspaceId, type: "linkedin_post", payload: payload as unknown as Record<string, unknown>, createdBy });
}

export function createGithubIssueDraft(
  userId: string,
  workspaceId: string,
  payload: GithubIssueActionPayload,
  createdBy: "agent" | "user" = "agent"
): Promise<PendingAction> {
  return pendingActionsRepository.create({ userId, workspaceId, type: "github_issue", payload: payload as unknown as Record<string, unknown>, createdBy });
}

export function createGithubCommentDraft(
  userId: string,
  workspaceId: string,
  payload: GithubCommentActionPayload,
  createdBy: "agent" | "user" = "agent"
): Promise<PendingAction> {
  return pendingActionsRepository.create({ userId, workspaceId, type: "github_comment", payload: payload as unknown as Record<string, unknown>, createdBy });
}

export function createHrEventInviteDraft(userId: string, workspaceId: string, payload: HrEventInvitePayload): Promise<PendingAction> {
  return pendingActionsRepository.create({ userId, workspaceId, type: "hr_event_invite", payload: payload as unknown as Record<string, unknown>, createdBy: "user" });
}

export function listPendingActions(userId: string, workspaceId: string): Promise<PendingAction[]> {
  return pendingActionsRepository.listPending(userId, workspaceId);
}

export function getPendingAction(id: string, userId: string): Promise<PendingAction | null> {
  return pendingActionsRepository.findById(id, userId);
}

/**
 * Sends the calendar invite first (Google emails each attendee), then one
 * personal email per recipient. If the calendar step fails nothing has gone
 * out yet, so it throws and the action stays pending. Individual email
 * failures after that are reported in the result instead - some messages were
 * already sent, and retrying the whole action would duplicate them.
 */
async function runHrEventInvite(userId: string, workspaceId: string, payload: HrEventInvitePayload): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { recipients: payload.recipients.length };

  if (payload.addToCalendar) {
    const json = await callMcpTool("calendar_create_event", {
      summary: payload.summary,
      description: payload.description,
      startDateTime: payload.startDateTime,
      endDateTime: payload.endDateTime,
      timeZone: payload.timeZone,
      attendees: payload.recipients.map((r) => r.email),
      sendUpdates: "all",
      userId,
      workspaceId,
    });
    const event = JSON.parse(json) as { id?: string };
    result.calendarEventId = event.id ?? null;
    if (event.id) {
      await pool.query("UPDATE hr_events SET calendar_event_id = $1 WHERE id = $2 AND workspace_id = $3", [event.id, payload.hrEventId, workspaceId]);
    }
  }

  if (payload.sendEmail && payload.emailSubject && payload.emailBody) {
    const failed: Array<{ email: string; error: string }> = [];
    let sent = 0;
    for (const recipient of payload.recipients) {
      const firstName = recipient.name.trim().split(/\s+/)[0] || recipient.name;
      try {
        await callMcpTool("gmail_send_message", {
          to: recipient.email,
          subject: payload.emailSubject,
          body: payload.emailBody.replaceAll("{name}", firstName),
          userId,
          workspaceId,
        });
        sent += 1;
      } catch (err) {
        failed.push({ email: recipient.email, error: err instanceof Error ? err.message : "send failed" });
      }
    }
    result.emailsSent = sent;
    result.emailsFailed = failed;
  }

  return result;
}

export async function approvePendingAction(
  id: string,
  userId: string,
  overridePayload?: Record<string, unknown>
): Promise<PendingAction> {
  const existing = await pendingActionsRepository.findById(id, userId);
  if (!existing) throw new Error(`No pending action with id "${id}"`);
  if (existing.status !== "pending") throw new Error(`This action was already ${existing.status} - refresh and try again.`);
  const workspaceId = existing.workspaceId;
  if (!workspaceId) throw new Error("This draft is not linked to a workspace. Please recreate it.");

  const payload = { ...existing.payload, ...(overridePayload ?? {}) };
  let result: Record<string, unknown>;

  if (existing.type === "email") {
    const { to, subject, body, cc, attachCv } = payload as EmailActionPayload;
    const args: Record<string, unknown> = { to, subject, body, userId, workspaceId };
    if (cc) args.cc = cc;
    if (attachCv) args.attachCv = true;
    const json = await callMcpTool("gmail_send_message", args);
    result = JSON.parse(json);
  } else if (existing.type === "linkedin_post") {
    const { commentary, imageRef } = payload as LinkedinActionPayload;
    const json = await callMcpTool("linkedin_create_post", { commentary, imageRef, userId, workspaceId });
    result = JSON.parse(json);
  } else if (existing.type === "github_issue") {
    const { repo, title, body } = payload as GithubIssueActionPayload;
    const json = await callMcpTool("github_create_issue", { repo, title, body, userId, workspaceId });
    result = JSON.parse(json);
  } else if (existing.type === "github_comment") {
    const { repo, issueNumber, body } = payload as GithubCommentActionPayload;
    const json = await callMcpTool("github_create_issue_comment", { repo, issueNumber, body, userId, workspaceId });
    result = JSON.parse(json);
  } else {
    // Recipients and timing are fixed at draft time; only the wording can be edited on approval.
    const invite = existing.payload as HrEventInvitePayload;
    const edits = overridePayload ?? {};
    result = await runHrEventInvite(userId, workspaceId, {
      ...invite,
      emailSubject: typeof edits.subject === "string" ? edits.subject : invite.emailSubject,
      emailBody: typeof edits.body === "string" ? edits.body : invite.emailBody,
    });
  }

  const updated = await pendingActionsRepository.markDecided(id, userId, "approved", result);
  if (!updated) {
    throw new Error(`"${existing.type}" action was already decided elsewhere, but this request also executed it - please check your Gmail/LinkedIn/GitHub to avoid a duplicate.`);
  }
  return updated;
}

export async function rejectPendingAction(id: string, userId: string): Promise<PendingAction> {
  const updated = await pendingActionsRepository.markDecided(id, userId, "rejected");
  if (!updated) throw new Error(`No pending action with id "${id}", or it was already decided.`);
  return updated;
}
