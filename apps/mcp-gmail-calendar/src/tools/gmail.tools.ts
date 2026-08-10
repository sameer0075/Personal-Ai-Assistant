import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as gmailClient from "../google/gmail.client.js";
import { jsonResult, errorResult } from "./tool-result.js";
import { getStoredFileBySourceType } from "../google/document-file.repository.js";

export function registerGmailTools(server: McpServer): void {
  server.registerTool(
    "gmail_list_messages",
    {
      title: "List Gmail messages",
      description:
        "Lists recent Gmail messages, optionally filtered by a Gmail search query (e.g. 'from:boss@company.com', " +
        "'is:unread', 'after:2026/07/01'). Returns id, subject, from, date, and a short snippet for each - call " +
        "gmail_get_message for the full body of a specific message.",
      inputSchema: {
        query: z.string().optional().describe("Gmail search syntax, e.g. 'is:unread from:someone@example.com'"),
        maxResults: z.number().int().min(1).max(50).optional().describe("Max messages to return (default 20)"),
      },
    },
    async ({ query, maxResults }) => {
      try {
        const messages = await gmailClient.listMessages({ query, maxResults });
        return jsonResult(messages);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "gmail_get_message",
    {
      title: "Get a Gmail message",
      description: "Fetches the full subject, sender, recipient, date, and plain-text body of a single Gmail message by ID.",
      inputSchema: {
        messageId: z.string().describe("The Gmail message ID, from gmail_list_messages"),
      },
    },
    async ({ messageId }) => {
      try {
        const message = await gmailClient.getMessage(messageId);
        return jsonResult(message);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "gmail_send_message",
    {
      title: "Send a Gmail message",
      description:
        "Sends an email from the user's connected Gmail account. This actually sends the email - only call it " +
        "when the user has asked for an email to be sent, and confirm the recipient/content look right first. " +
        "Set attachCv: true when the user asks to send/share/attach their CV or resume - this attaches the " +
        "actual uploaded file, not just a text summary of its contents.",
      inputSchema: {
        to: z.string().email().describe("Recipient email address"),
        subject: z.string().min(1).describe("Email subject line"),
        body: z.string().min(1).describe("Plain-text email body"),
        cc: z.string().email().optional().describe("Optional CC email address"),
        attachCv: z
          .boolean()
          .optional()
          .describe("Set true to attach the user's most recently uploaded CV file to this email"),
      },
    },
    async ({ to, subject, body, cc, attachCv }) => {
      try {
        let attachment: { filename: string; mimeType: string; base64Data: string } | undefined;

        if (attachCv) {
          const file = await getStoredFileBySourceType("cv");
          if (!file) {
            return errorResult(
              new Error("No CV file is on record to attach. Ask the user to upload their CV first.")
            );
          }
          attachment = file;
        }

        const result = await gmailClient.sendMessage({ to, subject, body, cc, attachment });
        return jsonResult({ sent: true, attached: Boolean(attachment), ...result });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // add inside registerGmailTools, alongside the existing gmail_send_message registration

server.registerTool(
  "gmail_send_bulk",
  {
    title: "Send a bulk email",
    description:
      "Sends the SAME subject/body email to MANY recipients in one call (e.g. job application emails to a list " +
      "of company addresses). Use this instead of calling gmail_send_message repeatedly in a loop - this handles " +
      "the whole batch in a single tool call. Set attachCv: true to attach the user's CV to every email sent.",
    inputSchema: {
      recipients: z.array(z.string().email()).min(1).max(200).describe("List of recipient email addresses"),
      subject: z.string().min(1).describe("Email subject line, same for every recipient"),
      body: z.string().min(1).describe("Plain-text email body, same for every recipient"),
      attachCv: z.boolean().optional().describe("Set true to attach the user's most recently uploaded CV to every email"),
    },
  },
  async ({ recipients, subject, body, attachCv }) => {
    try {
      let attachment: { filename: string; mimeType: string; base64Data: string } | undefined;

      if (attachCv) {
        const file = await getStoredFileBySourceType("cv");
        if (!file) {
          return errorResult(new Error("No CV file is on record to attach. Ask the user to upload their CV first."));
        }
        attachment = file;
      }

      const results = await gmailClient.sendBulkMessages({ recipients, subject, body, attachment });
      const sent = results.filter((r) => r.sent).length;
      const failed = results.filter((r) => !r.sent);

      return jsonResult({
        totalRecipients: recipients.length,
        sent,
        failed: failed.length,
        failures: failed, // so the agent can report which addresses bounced and why
      });
    } catch (err) {
      return errorResult(err);
    }
  }
);
}