import { schedule as cronSchedule, validate as validateCron } from "node-cron";
import { automationsRepository } from "./automations.repository.js";
import { runAssistantAgent } from "../agent/assistant-agent.graph.js";
import { chatSessionRepository } from "../chat-sessions/chat-session.repository.js";
import { listSessions } from "../chat-sessions/chat-session.service.js";
import { ingestText } from "../rag/ingest-text.service.js";
import { googleCredentialsRepository } from "../google-auth/google-credentials.repository.js";
import { userRepository } from "../auth/user.repository.js";
import { callMcpTool } from "../mcp/mcp-client.service.js";
import type {
  ScheduledTask,
  CreateAutomationInput,
  ScheduleDefinition,
  UpdateAutomationInput,
  ChatSession,
} from "../../types/index.js";

/** How often the worker wakes up to check for due automations. */
export const POLL_INTERVAL_MS = 30_000;
/** A claimed-but-unfinished run older than this is considered crashed and re-claimable. */
export const CLAIM_STALE_MS = 5 * 60 * 1000;

/**
 * Computes the next fire time from a cron expression, strictly after `after`.
 * Throws a clear message on an invalid expression or timezone.
 */
export function nextCronRun(expr: string, timezone: string, after: Date = new Date()): Date {
  if (!validateCron(expr)) {
    throw new Error(`"${expr}" is not a valid cron expression (expected: minute hour day month weekday)`);
  }
  let task;
  try {
    task = cronSchedule(expr, () => {}, { timezone });
  } catch (err) {
    throw new Error(`Invalid timezone "${timezone}": ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const next = task.getNextRun();
    if (!next || next.getTime() <= after.getTime()) {
      throw new Error(`Cron "${expr}" never fires after now`);
    }
    return next;
  } finally {
    task.destroy();
  }
}

/** Turns a client schedule definition into `{ triggerAt, cronExpr, intervalMinutes, timezone }`. */
function materializeSchedule(
  schedule: ScheduleDefinition,
  now: Date = new Date()
): Pick<ScheduledTask, "cronExpr" | "intervalMinutes" | "timezone"> & { triggerAt: Date } {
  const timezone = schedule.timezone?.trim() || "UTC";

  if (schedule.kind === "once") {
    if (!schedule.at) throw new Error("A one-shot automation needs an 'at' datetime");
    const at = new Date(schedule.at);
    if (Number.isNaN(at.getTime())) throw new Error(`"${schedule.at}" is not a valid datetime`);
    if (at.getTime() <= now.getTime()) throw new Error("The trigger time must be in the future");
    return { triggerAt: at, cronExpr: null, intervalMinutes: null, timezone };
  }

  if (schedule.kind === "interval") {
    const minutes = schedule.intervalMinutes;
    if (!minutes || !Number.isInteger(minutes) || minutes < 1) {
      throw new Error("Interval automations need intervalMinutes (a whole number ≥ 1)");
    }
    const at = schedule.at ? new Date(schedule.at) : now;
    if (Number.isNaN(at.getTime())) throw new Error(`"${schedule.at}" is not a valid datetime`);
    return { triggerAt: at, cronExpr: null, intervalMinutes: minutes, timezone };
  }

  // cron
  if (!schedule.cron) throw new Error("Cron automations need a cron expression");
  const triggerAt = nextCronRun(schedule.cron, timezone);
  return { triggerAt, cronExpr: schedule.cron, intervalMinutes: null, timezone };
}

/**
 * Email delivery sends from the user's connected Gmail, so Google must be
 * connected - but the destination defaults to the *logged-in account's* email,
 * never a hardcoded or shared address.
 */
async function requireGoogleConnected(userId: string): Promise<void> {
  const status = await googleCredentialsRepository.getStatus(userId);
  if (!status.connected) {
    throw new Error("Email delivery needs a connected Google account — connect it in Integrations first.");
  }
}

async function getAccountEmail(userId: string): Promise<string> {
  const user = await userRepository.findById(userId);
  if (!user?.email) throw new Error("No email on file for this account");
  return user.email;
}

/** Defaults the email destination + subject, validates the mode, and sanity-checks Google connectivity. */
async function materializeDelivery(
  userId: string,
  title: string,
  delivery: CreateAutomationInput["delivery"]
): Promise<Pick<ScheduledTask, "deliveryMode" | "emailTo" | "emailSubject">> {
  const mode = delivery?.mode ?? "chat";
  let emailTo = delivery?.emailTo?.trim() || null;
  let emailSubject = delivery?.emailSubject?.trim() || null;

  if (mode === "chat") {
    return { deliveryMode: mode, emailTo: null, emailSubject: null };
  }

  // email / both → connection is required to send, and the destination is the
  // logged-in user's own email unless they explicitly override it.
  await requireGoogleConnected(userId);
  if (!emailTo) {
    emailTo = await getAccountEmail(userId);
  }
  if (!emailSubject) {
    emailSubject = `[Automation: ${title}]`;
  }
  return { deliveryMode: mode, emailTo, emailSubject };
}

export async function createAutomation(userId: string, input: CreateAutomationInput): Promise<ScheduledTask> {
  const materialized = materializeSchedule(input.schedule);
  const delivery = await materializeDelivery(userId, input.title, input.delivery);
  return automationsRepository.create({
    userId,
    title: input.title.trim(),
    prompt: input.prompt.trim(),
    scheduleKind: input.schedule.kind,
    ...materialized,
    ...delivery,
    deliverToSessionId: input.deliverToSessionId ?? null,
  });
}

export function listAutomations(userId: string): Promise<ScheduledTask[]> {
  return automationsRepository.list(userId);
}

export async function updateAutomation(
  userId: string,
  id: string,
  input: UpdateAutomationInput
): Promise<ScheduledTask> {
  const existing = await automationsRepository.get(id, userId);
  if (!existing) throw new Error("Automation not found");

  const patch: Parameters<typeof automationsRepository.update>[2] = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.prompt !== undefined) patch.prompt = input.prompt.trim();
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.deliverToSessionId !== undefined) patch.deliverToSessionId = input.deliverToSessionId || null;

  // Re-materialize the schedule when it changes so the next trigger is fresh.
  if (input.schedule !== undefined) {
    const materialized = materializeSchedule(input.schedule);
    patch.scheduleKind = input.schedule.kind;
    patch.cronExpr = materialized.cronExpr;
    patch.intervalMinutes = materialized.intervalMinutes;
    patch.timezone = materialized.timezone;
    patch.triggerAt = materialized.triggerAt;
  }

  if (input.delivery !== undefined) {
    const merged = await materializeDelivery(userId, existing.title, {
      mode: input.delivery.mode ?? existing.deliveryMode,
      emailTo: input.delivery.emailTo ?? existing.emailTo ?? undefined,
      emailSubject: input.delivery.emailSubject ?? existing.emailSubject ?? undefined,
    });
    patch.deliveryMode = merged.deliveryMode;
    patch.emailTo = merged.emailTo;
    patch.emailSubject = merged.emailSubject;
  }

  const updated = await automationsRepository.update(id, userId, patch);
  if (!updated) throw new Error("Automation not found");
  return updated;
}

export async function deleteAutomation(userId: string, id: string): Promise<void> {
  const removed = await automationsRepository.remove(id, userId);
  if (!removed) throw new Error("Automation not found");
}

/** Session an automation's answer lands in: its pinned one, else the most recent chat, else a new one. */
async function resolveDeliverySession(task: ScheduledTask): Promise<ChatSession> {
  if (task.deliverToSessionId) {
    const pinned = await chatSessionRepository.getSession(task.deliverToSessionId, task.userId);
    if (pinned) return pinned;
  }
  const sessions = await listSessions(task.userId);
  if (sessions[0]) return sessions[0];
  return chatSessionRepository.createSession(task.userId, task.title);
}

/** Next trigger after a successful run, or null for a one-shot (which is then disabled). */
function computeNextTrigger(task: ScheduledTask, lastRunAt: Date): Date | null {
  if (task.scheduleKind === "once") return null;
  if (task.scheduleKind === "interval") {
    if (!task.intervalMinutes) throw new Error(`Automation "${task.title}" has no interval`);
    return new Date(lastRunAt.getTime() + task.intervalMinutes * 60_000);
  }
  if (!task.cronExpr) throw new Error(`Automation "${task.title}" has no cron expression`);
  return nextCronRun(task.cronExpr, task.timezone);
}

async function runOne(task: ScheduledTask): Promise<void> {
  const started = Date.now();
  const result = await runAssistantAgent(task.userId, task.prompt);

  if (task.deliveryMode !== "chat") {
    const to = task.emailTo ?? (await getAccountEmail(task.userId));
    const subject = task.emailSubject ?? `[Automation: ${task.title}]`;
    const body = `Automation: ${task.title}\nRun at: ${new Date().toLocaleString()}\n\n${result.answer}`;
    await callMcpTool("gmail_send_message", { to, subject, body, userId: task.userId });
    console.log(`✉️ [automations] emailed "${task.title}" to ${to}`);
  }

  if (task.deliveryMode !== "email") {
    const session = await resolveDeliverySession(task);
    await chatSessionRepository.appendMessage({
      sessionId: session.id,
      role: "assistant",
      content: `⏰ [Automation: ${task.title}]\n\n${result.answer}`,
      toolCalls: result.toolCalls,
      pendingActionIds: result.pendingActions.map((a) => a.id),
    });
    ingestText({
      userId: task.userId,
      title: `Automation: ${task.title}`,
      text: `Automation "${task.title}" ran:\n\n${result.answer}`,
      sourceType: "conversation",
      metadata: { sessionId: session.id },
    }).catch((err) => {
      console.error(`[automations] failed to index run of "${task.title}":`, err);
    });
  }

  const lastRunAt = new Date();
  await automationsRepository.markSuccess(task.id, lastRunAt, computeNextTrigger(task, lastRunAt), task.scheduleKind !== "once");
  console.log(`✅ [automations] "${task.title}" finished in ${Date.now() - started}ms`);
}

/** Runs every due automation once. Called on each poll tick. */
export async function runDueAutomations(now: Date = new Date()): Promise<number> {
  const staleSince = new Date(now.getTime() - CLAIM_STALE_MS);
  const due = await automationsRepository.claimDue(now, staleSince);
  for (const task of due) {
    try {
      await runOne(task);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[automations] "${task.title}" failed:`, message);
      await automationsRepository.markFailed(task.id, message);
    }
  }
  return due.length;
}

/** Runs one automation immediately, outside the claim cycle (e.g. the "Run now" button). */
export async function runAutomationNow(userId: string, id: string): Promise<{ answer: string }> {
  const task = await automationsRepository.get(id, userId);
  if (!task) throw new Error("Automation not found");
  await runOne(task);
  return { answer: "Ran successfully — delivered to chat and/or email." };
}

/* --------------------------------- worker loop --------------------------------- */

let workerTimer: ReturnType<typeof setInterval> | null = null;

export function startAutomationWorker(): void {
  if (workerTimer) return;
  // First tick shortly after boot; then on the poll interval.
  setTimeout(() => {
    runDueAutomations().catch((err) => console.error("[automations] worker tick failed:", err));
  }, 8_000);
  workerTimer = setInterval(() => {
    runDueAutomations().catch((err) => console.error("[automations] worker tick failed:", err));
  }, POLL_INTERVAL_MS);
  console.log(`🤖 automation worker started (poll every ${POLL_INTERVAL_MS / 1000}s)`);
}

export function stopAutomationWorker(): void {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
}