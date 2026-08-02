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

async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  const auth = await getGoogleAuthClient();
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

export async function listEvents(params: {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}): Promise<CalendarEventSummary[]> {
  const calendar = await getCalendarClient();

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

export async function createEvent(params: {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  attendees?: string[];
}): Promise<CalendarEventSummary> {
  const calendar = await getCalendarClient();

  const { data } = await calendar.events.insert({
    calendarId: "primary",
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

export async function deleteEvent(eventId: string): Promise<void> {
  const calendar = await getCalendarClient();
  await calendar.events.delete({ calendarId: "primary", eventId });
}