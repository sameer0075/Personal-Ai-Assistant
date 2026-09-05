import { embeddingService } from "../embeddings/embedding.service.js";
import { searchRepository, chunkRowToHit, type ChunkSearchRow } from "./search.repository.js";
import type { UnifiedSearchGroup, UnifiedSearchHit, UnifiedSearchResult } from "../../types/index.js";

const MAX_QUERY_LENGTH = 200;

/** Cosine scores below this are treated as noise and dropped from semantic hits. */
const MIN_SEMANTIC_SIMILARITY = 0.18;

/** Result cap applied per source group (chat stays scannable, not a firehose). */
const PER_GROUP_LIMIT = 8;

export interface UnifiedSearchOptions {
  /** Per-group cap (defaults to PER_GROUP_LIMIT). */
  limit?: number;
}

/**
 * Search across everything a user owns in one call: direct chat messages,
 * knowledge-base documents, locally-tracked LinkedIn posts, and the embedded
 * emails/events/posts indexed into RAG. Keyword matches hit the raw text
 * columns; semantic matches hit the pgvector index the agent's own RAG search
 * uses - so this is a superset of the agent's lookup, not a rewrite of it.
 */
export async function unifiedSearch(
  userId: string,
  rawQuery: string,
  options: UnifiedSearchOptions = {}
): Promise<UnifiedSearchResult> {
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  const startedAt = Date.now();

  if (!query) {
    return { query, tookMs: Date.now() - startedAt, highlight: null, groups: [] };
  }

  const limit = Math.max(1, Math.min(50, options.limit ?? PER_GROUP_LIMIT));

  // 1. Keyword search across the directly-searchable text columns, in parallel.
  const [chatRows, documentTitles, linkedinPosts, keywordChunks] = await Promise.all([
    searchRepository.searchChatMessages(userId, query, limit),
    searchRepository.searchDocumentsByTitle(userId, query, limit),
    searchRepository.searchLinkedinPosts(userId, query, limit),
    searchRepository.searchChunksByKeyword(userId, query, limit),
  ]);

  // 2. Semantic search over the pgvector index. Best-effort: if the embedding
  //    model isn't warm yet (or something else fails) we degrade to keyword
  //    results instead of failing the whole request.
  let semanticChunks: ChunkSearchRow[] = [];
  try {
    const queryEmbedding = await embeddingService.embed(query);
    const hits = await searchRepository.searchSimilarChunks(userId, queryEmbedding, limit * 2);
    semanticChunks = hits.filter((row) => Number(row.similarity) >= MIN_SEMANTIC_SIMILARITY);
  } catch (err) {
    console.error("[search] semantic search unavailable (showing keyword results only):", err);
  }

  const keywordHits = keywordChunks.map((c) => chunkRowToHit(c, "keyword"));
  const semanticHits = semanticChunks.map((c) => chunkRowToHit(c, "semantic"));

  const bySource = (source: UnifiedSearchHit["source"]) => ({
    keyword: keywordHits.filter((h) => h.source === source),
    semantic: semanticHits.filter((h) => h.source === source),
  });

  const groups: UnifiedSearchGroup[] = [];

  groups.push(
    buildLinkedinGroup(linkedinPosts, bySource("linkedin"), limit)
  );

  groups.push(
    buildGroup("documents", "Documents", bySource("documents").semantic, [
      ...documentTitles.map(
        (row): UnifiedSearchHit => ({
          id: row.id,
          source: "documents",
          title: row.title || "(untitled document)",
          snippet: (row.metadata?.snippet as string | undefined) ?? "",
          matchedBy: "keyword",
          similarity: null,
          createdAt: row.createdAt,
          metadata: row.metadata,
        })
      ),
      ...bySource("documents").keyword,
    ], limit)
  );

  // Chat fuses direct message rows with RAG "conversation" chunks.
  groups.push(
    buildGroup("chat", "Chat", bySource("conversation").semantic.concat(bySource("chat").semantic), [
      ...chatRows.map(
        (row): UnifiedSearchHit => ({
          id: row.id,
          source: "chat",
          title: row.sessionTitle || "Chat",
          snippet: row.content,
          matchedBy: "keyword",
          similarity: null,
          createdAt: row.createdAt,
          role: row.role,
          sessionId: row.sessionId,
          sessionTitle: row.sessionTitle,
        })
      ),
      ...bySource("chat").keyword,
      ...bySource("conversation").keyword,
    ], limit)
  );

  groups.push(buildGroup("email", "Emails", bySource("email").semantic, bySource("email").keyword, limit));
  groups.push(buildGroup("calendar", "Calendar", bySource("calendar").semantic, bySource("calendar").keyword, limit));

  // Stable-ish display order: chat first, then connected sources, docs last.
  const ordered = (["chat", "email", "calendar", "linkedin", "documents"] as const)
    .map((s) => groups.find((g) => g.source === s))
    .filter((g): g is UnifiedSearchGroup => g !== undefined && g.total > 0);

  return {
    query,
    tookMs: Date.now() - startedAt,
    highlight: pickHighlight(ordered),
    groups: ordered,
  };
}

/** LinkedIn group: local post rows (keyword) fused with chunk hits from RAG. */
function buildLinkedinGroup(
  posts: Array<{ id: string; commentary: string; publishedAt: string }>,
  chunkHits: { keyword: UnifiedSearchHit[]; semantic: UnifiedSearchHit[] },
  limit: number
): UnifiedSearchGroup {
  const postHits: UnifiedSearchHit[] = posts.map((row) => ({
    id: row.id,
    source: "linkedin",
    title: "LinkedIn post",
    snippet: row.commentary,
    matchedBy: "keyword",
    similarity: null,
    createdAt: row.publishedAt,
  }));
  return buildGroup("linkedin", "LinkedIn", chunkHits.semantic, [...postHits, ...chunkHits.keyword], limit);
}

/** Fuses semantic + keyword hits into one scored, capped group. */
function buildGroup(
  source: UnifiedSearchGroup["source"],
  label: string,
  semantic: UnifiedSearchHit[],
  keyword: UnifiedSearchHit[],
  limit: number
): UnifiedSearchGroup {
  // Semantic hits win dedup conflicts (they carry a relevance score).
  const byId = new Map<string, UnifiedSearchHit>();
  for (const hit of semantic) byId.set(hit.id, hit);
  for (const hit of keyword) if (!byId.has(hit.id)) byId.set(hit.id, hit);

  const hits = sortHits([...byId.values()]).slice(0, limit);
  return { source, label, total: hits.length, hits };
}

/** Semantic hits score-first; keyword hits newest-first; semantic always first. */
function sortHits(hits: UnifiedSearchHit[]): UnifiedSearchHit[] {
  return [...hits].sort((a, b) => {
    if (a.matchedBy === "semantic" && b.matchedBy === "semantic") {
      return (b.similarity ?? 0) - (a.similarity ?? 0);
    }
    if (a.matchedBy === "keyword" && b.matchedBy === "keyword") {
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    }
    return a.matchedBy === "semantic" ? -1 : 1;
  });
}

/**
 * The single group worth showing before everything else: the one containing
 * the strongest semantic match, else the biggest group, else none.
 */
function pickHighlight(groups: UnifiedSearchGroup[]): UnifiedSearchGroup | null {
  if (groups.length === 0) return null;

  let best: UnifiedSearchGroup | null = null;
  let bestScore = 0;
  for (const group of groups) {
    const score = Math.max(...group.hits.map((h) => h.similarity ?? 0));
    if (score > bestScore) {
      bestScore = score;
      best = group;
    }
  }
  if (best && bestScore > 0) return best;

  return [...groups].sort((a, b) => b.total - a.total)[0] ?? null;
}