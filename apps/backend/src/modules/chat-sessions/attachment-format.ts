import type { ChatAttachment } from "../../types/index.js";

export const MAX_ATTACHMENT_CHARS = 20_000;

export function truncateAttachmentText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_ATTACHMENT_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_ATTACHMENT_CHARS), truncated: true };
}

export function formatContentForAgent(content: string, attachments?: ChatAttachment[] | null): string {
  if (!attachments || attachments.length === 0) return content;

  const blocks = attachments.map((a) => {
    const note = a.truncated ? " (truncated)" : "";
    return `--- Attached file: ${a.filename}${note} ---\n${a.text}`;
  });

  return [...blocks, content].join("\n\n");
}