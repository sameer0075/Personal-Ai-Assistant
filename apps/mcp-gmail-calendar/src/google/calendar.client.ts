import { google, calendar_v3 } from "googleapis";
import { getGoogleAuthClient } from "./oauth-client.js";

export interface CalendarEventSummary {
  id: string;
  summary: string;
  description: string | null;
  start: string;
  end: string;
  attendees: string[];
}

async function getCalendarClient(userId: string, workspaceId: string): Promise<calendar_v3.Calendar> {
  const auth = await getGoogleAuthClient(userId, workspaceId);
  return google.calendar({ version: "v3", auth });
}

function toSummary(event: calendar_v3.Schema$Event): CalendarEventSummary {
  return {
    id: event.id!,
    summary: event.summary ?? "(untitled event)",
    description: event.description ?? null,
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    attendees: (event.attendees ?? []).map((a) => a.email).filter((e): e is string => Boolean(e)),
  };
}

export async function listEvents(
  userId: string,
  workspaceId: string,
  params: { timeMin?: string; timeMax?: string; maxResults?: number }
): Promise<CalendarEventSummary[]> {
  const calendar = await getCalendarClient(userId, workspaceId);
  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: params.timeMin ?? new Date().toISOString(),
    timeMax: params.timeMax,
    maxResults: params.maxResults ?? 25,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (data.items ?? []).map(toSummary);
}

export async function createEvent(
  userId: string,
  workspaceId: string,
  params: { summary: string; description?: string; startDateTime: string; endDateTime: string; timeZone?: string; attendees?: string[]; sendUpdates?: "all" | "none" }
): Promise<CalendarEventSummary> {
  const calendar = await getCalendarClient(userId, workspaceId);
  const { data } = await calendar.events.insert({
    calendarId: "primary",
    // "all" makes Google email each attendee an invitation; the default sends nothing.
    sendUpdates: params.sendUpdates ?? "none",
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startDateTime, timeZone: params.timeZone },
      end: { dateTime: params.endDateTime, timeZone: params.timeZone },
      attendees: params.attendees?.map((email) => ({ email })),
    },
  });
  return toSummary(data);
}

export async function deleteEvent(userId: string, workspaceId: string, eventId: string): Promise<void> {
  const calendar = await getCalendarClient(userId, workspaceId);
  await calendar.events.delete({ calendarId: "primary", eventId });
}