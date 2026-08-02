import { apiFetch, apiJson } from "./client";
import type { SyncSummary } from "./gmail";

export interface CalendarEventSummary {
  id: string;
  summary: string;
  description: string | null;
  start: string;
  end: string;
  attendees: string[];
}

export function listCalendarEvents(
  params: { timeMin?: string; timeMax?: string; maxResults?: number } = {}
): Promise<CalendarEventSummary[]> {
  const search = new URLSearchParams();
  if (params.timeMin) search.set("timeMin", params.timeMin);
  if (params.timeMax) search.set("timeMax", params.timeMax);
  if (params.maxResults) search.set("maxResults", String(params.maxResults));
  const qs = search.toString();

  return apiFetch<CalendarEventSummary[]>(`/calendar/events${qs ? `?${qs}` : ""}`);
}

export function createCalendarEvent(input: {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: string[];
}): Promise<CalendarEventSummary> {
  return apiJson("/calendar/events", "POST", input);
}

export function deleteCalendarEvent(eventId: string): Promise<void> {
  return apiJson<void>(`/calendar/events/${eventId}`, "DELETE");
}

export function syncCalendarToRag(
  input: { timeMin?: string; timeMax?: string; maxResults?: number } = {}
): Promise<SyncSummary> {
  return apiJson<SyncSummary>("/calendar/sync-to-rag", "POST", input);
}