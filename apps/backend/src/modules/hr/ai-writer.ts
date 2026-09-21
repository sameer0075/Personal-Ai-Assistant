import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel } from "../llm/llm.provider.js";

/** "Label: value" line for a prompt brief, or null when there's nothing to say. */
export function briefLine(label: string, value: string | null | undefined | string[]): string | null {
  const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : value?.trim();
  return text ? `${label}: ${text}` : null;
}

/** Runs a plain-text HR writing prompt and strips any markdown the model slips in. */
export async function writePlainText(systemPrompt: string, instructions: string, brief: Array<string | null>): Promise<string> {
  const response = await createChatModel().invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`${instructions}\n\n<brief>\n${brief.filter(Boolean).join("\n")}\n</brief>`),
  ]);
  const text = typeof response.content === "string"
    ? response.content
    : response.content.map((part) => ("text" in part && typeof part.text === "string" ? part.text : "")).join("");
  const cleaned = text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) throw new Error("The AI returned an empty description. Try again.");
  return cleaned;
}
