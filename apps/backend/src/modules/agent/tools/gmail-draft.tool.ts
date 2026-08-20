import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createEmailDraft } from "../../actions/pending-actions.service.js";

export const gmailDraftMessageTool = tool(
  async ({
    to,
    subject,
    body,
    cc,
    attachCv,
  }: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    attachCv?: boolean;
  }) => {
    const action = await createEmailDraft({ to, subject, body, cc, attachCv });
    return JSON.stringify({
      drafted: true,
      pendingActionId: action.id,
      note:
        "This email has NOT been sent. It is queued for the user's review in the app - " +
        "tell the user it's drafted and ready for their approval, never say it was sent.",
    });
  },
  {
    name: "gmail_draft_message",
    description:
      "Prepares an email (to, subject, body, optional cc) from the user's connected Gmail " +
      "account and queues it for human approval. This does NOT send the email - the user " +
      "must review and approve it in the app before anything is actually sent. Set " +
      "attachCv: true when the user asks to send/share/attach their CV or resume - this " +
      "attaches the actual uploaded file, not just a text summary of its contents. Always " +
      "use this tool when asked to send an email; never claim an email was sent.",
    schema: z.object({
      to: z.string().email().describe("Recipient email address"),
      subject: z.string().min(1).describe("Email subject line"),
      body: z.string().min(1).describe("Plain-text email body"),
      cc: z.string().email().optional().describe("Optional CC email address"),
      attachCv: z
        .boolean()
        .optional()
        .describe("Set true to attach the user's most recently uploaded CV file to this email"),
    }),
  }
);