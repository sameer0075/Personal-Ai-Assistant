import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as gmailClient from "../google/gmail.client.js";
import { jsonResult, errorResult } from "./tool-result.js";

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
        "Sends a plain-text email from the user's connected Gmail account. This actually sends the email - " +
        "only call it when the user has asked for an email to be sent, and confirm the recipient/content look right first.",
      inputSchema: {
        to: z.string().email().describe("Recipient email address"),
        subject: z.string().min(1).describe("Email subject line"),
        body: z.string().min(1).describe("Plain-text email body"),
        cc: z.string().email().optional().describe("Optional CC email address"),
      },
    },
    async ({ to, subject, body, cc }) => {
      try {
        const result = await gmailClient.sendMessage({ to, subject, body, cc });
        return jsonResult({ sent: true, ...result });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}