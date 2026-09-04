import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { RunnableConfig } from "@langchain/core/runnables";
import { retrieveRelevantChunks } from "../../rag/retrieve.service.js";

/**
 * The agent itself is a shared singleton (see getAgent() in
 * assistant-agent.graph.ts) reused across every request from every user, so
 * this tool can't just close over "the current user" - it reads userId from
 * LangChain's per-invocation RunnableConfig instead, which
 * streamAssistantAgent/runAssistantAgent populate via
 * `agent.stream(..., { configurable: { userId } })`. Every tool call made
 * during that one run automatically receives the same config, so this stays
 * scoped to whoever's request is actually running right now.
 */
export const searchKnowledgeBaseTool = tool(
  async ({ query }: { query: string }, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId as string | undefined;
    if (!userId) {
      throw new Error("search_knowledge_base called without a userId in context - this is a bug, not a user-facing error.");
    }

    const chunks = await retrieveRelevantChunks(userId, query);
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