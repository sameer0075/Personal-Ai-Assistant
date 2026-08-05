import { env } from "../config/env.js";

const TAVILY_BASE_URL = "https://api.tavily.com";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface SearchResponse {
  answer?: string;
  results: SearchResult[];
}

function commonHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.TAVILY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

/**
 * Runs a web search via Tavily. Unlike a raw SERP API, Tavily returns
 * AI-ready snippets (already-cleaned content per result) plus, optionally, a
 * short synthesized answer - exactly the shape an LLM wants, without the
 * agent having to fetch and parse raw HTML itself.
 */
export async function search(params: {
  query: string;
  maxResults?: number;
  topic?: "general" | "news" | "finance";
  includeAnswer?: boolean;
}): Promise<SearchResponse> {
  const response = await fetch(`${TAVILY_BASE_URL}/search`, {
    method: "POST",
    headers: commonHeaders(),
    body: JSON.stringify({
      query: params.query,
      search_depth: "basic", // "advanced" costs 2 credits/request instead of 1 - basic is enough for chat-agent lookups
      max_results: params.maxResults ?? 5,
      topic: params.topic ?? "general",
      include_answer: params.includeAnswer ?? true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as SearchResponse;
}

interface ExtractResult {
  url: string;
  raw_content: string;
}

interface ExtractResponse {
  results: ExtractResult[];
  failed_results: Array<{ url: string; error: string }>;
}

/** Fetches the full cleaned text content of specific URLs (e.g. a search result worth reading in full). */
export async function extract(urls: string[]): Promise<ExtractResponse> {
  const response = await fetch(`${TAVILY_BASE_URL}/extract`, {
    method: "POST",
    headers: commonHeaders(),
    body: JSON.stringify({ urls }),
  });

  if (!response.ok) {
    throw new Error(`Tavily extract failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as ExtractResponse;
}