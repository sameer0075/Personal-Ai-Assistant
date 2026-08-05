import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as tavily from "../tavily/tavily-client.js";
import { jsonResult, errorResult } from "./tool-result.js";

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    "web_search",
    {
      title: "Search the web",
      description:
        "Searches the live web and returns a short synthesized answer plus a handful of relevant sources " +
        "(title, url, snippet). Use this only for things not answerable from the user's personal knowledge " +
        "base or their connected Gmail/Calendar/LinkedIn - general knowledge, current events, facts about the " +
        "outside world, or anything time-sensitive. Call web_fetch on a specific URL from the results if you " +
        "need more than the snippet.",
      inputSchema: {
        query: z.string().min(1).describe("The search query"),
        maxResults: z.number().int().min(1).max(10).optional().describe("Max sources to return (default 5)"),
        topic: z
          .enum(["general", "news", "finance"])
          .optional()
          .describe("Narrows the search - use 'news' for current events, 'finance' for markets/companies"),
      },
    },
    async ({ query, maxResults, topic }) => {
      try {
        const response = await tavily.search({ query, maxResults, topic, includeAnswer: true });
        return jsonResult(response);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "web_fetch",
    {
      title: "Fetch a web page's full content",
      description:
        "Fetches the full cleaned text content of one or more specific URLs - use this when a web_search " +
        "snippet isn't enough detail and you need the whole page. Pass URLs exactly as returned by web_search.",
      inputSchema: {
        urls: z.array(z.string().url()).min(1).max(5).describe("The URL(s) to fetch full content for"),
      },
    },
    async ({ urls }) => {
      try {
        const response = await tavily.extract(urls);
        return jsonResult(response);
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}