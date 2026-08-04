import { callMcpTool } from "../mcp/mcp-client.service.js";
import { documentRepository } from "./document.repository.js";
import { ingestText } from "./ingest-text.service.js";

export interface SyncSummary {
  found: number;
  ingested: number;
  skipped: number;
}

interface GmailMessageSummary {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface GmailMessageFull extends GmailMessageSummary {
  to: string;
  body: string;
}

interface CalendarEventSummary {
  id: string;
  summary: string;
  description: string | null;
  start: string;
  end: string;
  attendees: string[];
}

interface LinkedinPostSummary {
  postUrn: string;
  commentary: string;
  publishedAt: string;
}

/**
 * Pulls recent Gmail messages (via the MCP server) and indexes any not
 * already in the vector store, so the chat agent's `search_knowledge_base`
 * tool can recall them later. Safe to call repeatedly (e.g. on a schedule) -
 * already-ingested messages are skipped by `metadata.externalId`.
 */
export async function syncGmailToRag(params: { query?: string; maxResults?: number } = {}): Promise<SyncSummary> {
  const listJson = await callMcpTool("gmail_list_messages", {
    query: params.query,
    maxResults: params.maxResults ?? 20,
  });
  const messages: GmailMessageSummary[] = JSON.parse(listJson);

  let ingested = 0;
  let skipped = 0;

  for (const message of messages) {
    const existing = await documentRepository.findByExternalId("email", message.id);
    if (existing) {
      skipped++;
      continue;
    }

    const fullJson = await callMcpTool("gmail_get_message", { messageId: message.id });
    const full: GmailMessageFull = JSON.parse(fullJson);

    await ingestText({
      title: full.subject || "(no subject)",
      text: [`Subject: ${full.subject}`, `From: ${full.from}`, `To: ${full.to}`, `Date: ${full.date}`, "", full.body].join(
        "\n"
      ),
      sourceType: "email",
      metadata: { externalId: full.id, from: full.from, date: full.date },
    });
    ingested++;
  }

  return { found: messages.length, ingested, skipped };
}

/**
 * Pulls upcoming Calendar events (via the MCP server) and indexes any not
 * already in the vector store, same dedup strategy as syncGmailToRag.
 */
export async function syncCalendarToRag(
  params: { timeMin?: string; timeMax?: string; maxResults?: number } = {}
): Promise<SyncSummary> {
  const listJson = await callMcpTool("calendar_list_events", {
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    maxResults: params.maxResults ?? 25,
  });
  const events: CalendarEventSummary[] = JSON.parse(listJson);

  let ingested = 0;
  let skipped = 0;

  for (const event of events) {
    const existing = await documentRepository.findByExternalId("calendar", event.id);
    if (existing) {
      skipped++;
      continue;
    }

    await ingestText({
      title: event.summary || "(untitled event)",
      text: [
        `Event: ${event.summary}`,
        event.description ? `Description: ${event.description}` : null,
        `Start: ${event.start}`,
        `End: ${event.end}`,
        event.attendees.length ? `Attendees: ${event.attendees.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      sourceType: "calendar",
      metadata: { externalId: event.id, start: event.start, end: event.end },
    });
    ingested++;
  }

  return { found: events.length, ingested, skipped };
}

/**
 * Pulls the assistant's own record of recently-published LinkedIn posts (see
 * linkedin_list_recent_posts / the linkedin_posts table - LinkedIn's API
 * won't give this back to us) and indexes any not already in the vector
 * store. This is what lets the agent check its own past posts for tone/topic
 * consistency before drafting new ones, via search_knowledge_base.
 */
export async function syncLinkedinToRag(params: { maxResults?: number } = {}): Promise<SyncSummary> {
  const listJson = await callMcpTool("linkedin_list_recent_posts", { maxResults: params.maxResults ?? 20 });
  const posts: LinkedinPostSummary[] = JSON.parse(listJson);

  let ingested = 0;
  let skipped = 0;

  for (const post of posts) {
    const existing = await documentRepository.findByExternalId("linkedin", post.postUrn);
    if (existing) {
      skipped++;
      continue;
    }

    await ingestText({
      title: post.commentary.slice(0, 60) || "(untitled post)",
      text: `Published: ${post.publishedAt}\n\n${post.commentary}`,
      sourceType: "linkedin",
      metadata: { externalId: post.postUrn, publishedAt: post.publishedAt },
    });
    ingested++;
  }

  return { found: posts.length, ingested, skipped };
}