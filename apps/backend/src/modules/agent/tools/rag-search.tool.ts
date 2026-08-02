import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { retrieveRelevantChunks } from "../../rag/retrieve.service.js";

/**
 * Turning retrieval into a *tool* (rather than always injecting context, as
 * Module 1's rag-agent.graph.ts did) is what lets the agent decide for itself
 * whether it needs to consult the user's personal knowledge base before
 * answering, versus just calling Gmail/Calendar tools directly, versus both.
 * That decision-making is exactly the "plan on its own" behaviour requested.
 */
export const searchKnowledgeBaseTool = tool(
  async ({ query }: { query: string }) => {
    const chunks = await retrieveRelevantChunks(query);
    if (!chunks.length) return "No relevant information found in the personal knowledge base.";

    return chunks
      .map((c, i) => `[${i + 1}] (similarity ${(c.similarity * 100).toFixed(0)}%) ${c.content}`)
      .join("\n\n");
  },
  {
    name: "search_knowledge_base",
    description:
      "Search the user's personal knowledge base - their CV plus any previously indexed emails and " +
      "calendar events - for context relevant to a question. Call this before answering questions " +
      "about the user (their background, past emails, upcoming events, etc).",
    schema: z.object({
      query: z.string().describe("The question or topic to search the knowledge base for"),
    }),
  }
);