import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as calendarClient from "../google/calendar.client.js";
import { jsonResult, errorResult } from "./tool-result.js";
import { requireUserId } from "./require-user-id.js";

/** See the comment above userIdField in gmail.tools.ts - same rationale (including why it's .optional()) applies here. */
const userIdField = z.string().uuid().optional().describe("Injected server-side - identifies which user's Google account to use");

export function registerCalendarTools(server: McpServer): void {
  server.registerTool(
    "calendar_list_events",
    {
      title: "List Calendar events",
      description:
        "Lists events on the user's primary Google Calendar between two times. Defaults to events from now onward " +
        "if timeMin/timeMax aren't given.",
      inputSchema: {
        timeMin: z.string().datetime().optional().describe("ISO 8601 datetime, e.g. 2026-08-02T00:00:00Z"),
        timeMax: z.string().datetime().optional().describe("ISO 8601 datetime"),
        maxResults: z.number().int().min(1).max(50).optional().describe("Max events to return (default 25)"),
        userId: userIdField,
      },
    },
    async ({ timeMin, timeMax, maxResults, userId }) => {
      try {
        const uid = requireUserId(userId);
        const events = await calendarClient.listEvents(uid, { timeMin, timeMax, maxResults });
        return jsonResult(events);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "calendar_create_event",
    {
      title: "Create a Calendar event",
      description:
        "Creates a new event on the user's primary Google Calendar. This actually creates the event - only call " +
        "it when the user has asked for something to be scheduled.",
      inputSchema: {
        summary: z.string().min(1).describe("Event title"),
        description: z.string().optional().describe("Event description/notes"),
        startDateTime: z.string().datetime().describe("ISO 8601 datetime"),
        endDateTime: z.string().datetime().describe("ISO 8601 datetime"),
        timeZone: z.string().optional().describe("IANA timezone, e.g. 'Asia/Karachi' (default: calendar's timezone)"),
        attendees: z.array(z.string().email()).optional().describe("Attendee email addresses to invite"),
        userId: userIdField,
      },
    },
    async ({ summary, description, startDateTime, endDateTime, timeZone, attendees, userId }) => {
      try {
        const uid = requireUserId(userId);
        const event = await calendarClient.createEvent(uid, {
          summary,
          description,
          startDateTime,
          endDateTime,
          timeZone,
          attendees,
        });
        return jsonResult({ created: true, ...event });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "calendar_delete_event",
    {
      title: "Delete a Calendar event",
      description: "Deletes an event from the user's primary Google Calendar by event ID. This cannot be undone.",
      inputSchema: {
        eventId: z.string().describe("The Calendar event ID, from calendar_list_events"),
        userId: userIdField,
      },
    },
    async ({ eventId, userId }) => {
      try {
        const uid = requireUserId(userId);
        await calendarClient.deleteEvent(uid, eventId);
        return jsonResult({ deleted: true, eventId });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}