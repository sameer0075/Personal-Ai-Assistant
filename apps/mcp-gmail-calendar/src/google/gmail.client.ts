import { google, gmail_v1 } from "googleapis";
import { getGoogleAuthClient } from "./oauth-client.js";
import { buildRawEmail } from "../mime/build-raw-email.js";

export interface GmailMessageSummary {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export interface GmailMessageFull extends GmailMessageSummary {
  to: string;
  body: string;
}

export interface BulkSendResult {
  to: string;
  sent: boolean;
  id?: string;
  threadId?: string;
  error?: string;
}

async function getGmailClient(): Promise<gmail_v1.Gmail> {
  const auth = await getGoogleAuthClient();
  return google.gmail({ version: "v1", auth });
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Decodes Gmail's base64url body data into a UTF-8 string. */
function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

/** Recursively walks MIME parts to find the first plain-text body. */
function extractPlainTextBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  for (const part of payload.parts ?? []) {
    const found = extractPlainTextBody(part);
    if (found) return found;
  }

  // Fall back to the top-level body if there were no parts at all (simple messages).
  return payload.body?.data ? decodeBase64Url(payload.body.data) : "";
}

export async function listMessages(params: { query?: string; maxResults?: number }): Promise<GmailMessageSummary[]> {
  const gmail = await getGmailClient();

  const { data } = await gmail.users.messages.list({
    userId: "me",
    q: params.query,
    maxResults: params.maxResults ?? 20,
  });

  const messageIds = data.messages ?? [];

  // Metadata-only fetches are cheap; run them concurrently rather than serially.
  const summaries = await Promise.all(
    messageIds.map(async (m): Promise<GmailMessageSummary> => {
      const { data: full } = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });

      return {
        id: full.id!,
        subject: headerValue(full.payload?.headers, "Subject") || "(no subject)",
        from: headerValue(full.payload?.headers, "From"),
        date: headerValue(full.payload?.headers, "Date"),
        snippet: full.snippet ?? "",
      };
    })
  );

  return summaries;
}

export async function getMessage(messageId: string): Promise<GmailMessageFull> {
  const gmail = await getGmailClient();

  const { data } = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });

  return {
    id: data.id!,
    subject: headerValue(data.payload?.headers, "Subject") || "(no subject)",
    from: headerValue(data.payload?.headers, "From"),
    to: headerValue(data.payload?.headers, "To"),
    date: headerValue(data.payload?.headers, "Date"),
    snippet: data.snippet ?? "",
    body: extractPlainTextBody(data.payload) || data.snippet || "",
  };
}

export async function sendMessage(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  attachment?: { filename: string; mimeType: string; base64Data: string };
}): Promise<{ id: string; threadId: string }> {
  const gmail = await getGmailClient();
  const raw = buildRawEmail(params);

  const { data } = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

  return { id: data.id!, threadId: data.threadId! };
}

export async function sendBulkMessages(params: {
  recipients: string[];
  subject: string;
  body: string;
  attachment?: { filename: string; mimeType: string; base64Data: string };
  delayMs?: number;
}): Promise<BulkSendResult[]> {
  const { recipients, subject, body, attachment, delayMs = 1500 } = params;
  const results: BulkSendResult[] = [];

  for (const to of recipients) {
    try {
      const result = await sendMessage({ to, subject, body, attachment });
      results.push({ to, sent: true, ...result });
    } catch (err) {
      results.push({ to, sent: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
    await delay(delayMs); // pace sends - avoids tripping Gmail's spam/abuse detection
  }

  return results;
}