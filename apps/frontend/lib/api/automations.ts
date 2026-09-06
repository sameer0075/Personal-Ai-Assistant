import { apiFetch, apiJson } from "./client";

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
  /** ISO datetime of the next intended run. */
  triggerAt: string;
  enabled: boolean;
  deliveryMode: DeliveryMode;
  /** Destination email; null = the logged-in account's email. Optional, never required. */
  emailTo: string | null;
  /** Email subject; null = "[Automation: <title>]". */
  emailSubject: string | null;
  deliverToSessionId: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  runCount: number;
  createdAt: string;
}

export interface ScheduleDefinition {
  kind: ScheduleKind;
  at?: string;
  intervalMinutes?: number;
  cron?: string;
  timezone?: string;
}

export interface DeliveryDefinition {
  mode: DeliveryMode;
  emailTo?: string;
  emailSubject?: string;
}

export function listAutomations(): Promise<ScheduledTask[]> {
  return apiFetch<ScheduledTask[]>("/automations");
}

export function createAutomation(body: {
  title: string;
  prompt: string;
  schedule: ScheduleDefinition;
  delivery?: DeliveryDefinition;
}): Promise<ScheduledTask> {
  return apiJson<ScheduledTask>("/automations", "POST", body);
}

export function updateAutomation(
  id: string,
  body: {
    enabled?: boolean;
    title?: string;
    prompt?: string;
    schedule?: ScheduleDefinition;
    delivery?: Partial<DeliveryDefinition>;
  }
): Promise<ScheduledTask> {
  return apiJson<ScheduledTask>(`/automations/${id}`, "PATCH", body);
}

export function deleteAutomation(id: string): Promise<void> {
  return apiJson(`/automations/${id}`, "DELETE");
}

export function runAutomation(id: string): Promise<{ answer: string }> {
  return apiJson(`/automations/${id}/run`, "POST");
}

/** The browser's IANA zone, so a cron like "0 9 * * 1-5" fires at the user's local 9am. */
export function browserTimezone(): string {
  if (typeof Intl === "undefined" || !Intl.DateTimeFormat().resolvedOptions().timeZone) return "UTC";
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Local datetime-local value → UTC ISO string, or undefined when empty. */
export function toUtcIso(datetimeLocal: string): string | undefined {
  if (!datetimeLocal.trim()) return undefined;
  const date = new Date(datetimeLocal);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}