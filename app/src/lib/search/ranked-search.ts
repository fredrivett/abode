import { createLogger } from "@/lib/logger.server";
import {
  fullTextSearch,
  ocrTextSearch,
  phraseSearch,
} from "@/lib/search/full-text-search";
import type { ParsedFilters } from "@/lib/search/query-builder";
import { parseQuotedQuery } from "@/lib/search/quoted-phrases";
import { mergeSearchResults } from "@/lib/search/rrf";
import { vectorSearch } from "@/lib/search/vector-search";

const log = createLogger("lib/search/ranked-search");

/** Default cap on ranked results, matching the search API's page fetch. */
export const DEFAULT_RANKED_LIMIT = 100;

/**
 * One ranked hit: the item id plus the cross-retriever metadata a caller needs
 * to explain the match. Ordered by RRF rank, best first.
 */
export type RankedSearchResult = {
  id: string;
  sources: string[];
  ocrSnippet: string | null;
  vectorSimilarity: number | null;
};

export type RankedSearchOptions = {
  limit?: number;
  /** Called when vector search fails and results fall back to text + OCR only. */
  onVectorUnavailable?: () => void;
};

/**
 * Full-text + vector + OCR search fused with reciprocal rank fusion. Shared by
 * the search API and the MCP server so both rank identically. Returns ordered
 * item ids with match metadata; hydrating those ids into full items is the
 * caller's job. Vector search failure degrades to text + OCR (never throws).
 *
 * Quoted phrases in the query are exact-match requirements: every retriever is
 * restricted to items containing them, and any exact match none of the
 * retrievers ranked is appended after the ranked ones (source `"phrase"`).
 */
export async function rankedSearch(
  userId: string,
  filters: ParsedFilters,
  query: string,
  options: RankedSearchOptions = {},
): Promise<RankedSearchResult[]> {
  const limit = options.limit ?? DEFAULT_RANKED_LIMIT;
  const { text, phrases } = parseQuotedQuery(query);
  if (!text) return [];
  const scopedFilters: ParsedFilters =
    phrases.length > 0 ? { ...filters, phrases } : filters;

  const [textResults, vectorResults, ocrResults, phraseResults] =
    await Promise.all([
      fullTextSearch(userId, scopedFilters, text, limit),
      vectorSearch(userId, scopedFilters, text, limit).catch((error) => {
        log.error({ error }, "Vector search failed, falling back to text-only");
        options.onVectorUnavailable?.();
        return [];
      }),
      ocrTextSearch(userId, scopedFilters, text, limit),
      phraseSearch(userId, scopedFilters, limit),
    ]);

  const ranked = mergeSearchResults(textResults, vectorResults, ocrResults, {
    k: 60,
    limit,
  });
  const rankedIds = new Set(ranked.map((result) => result.id));
  const merged = [
    ...ranked,
    ...phraseResults
      .filter((id) => !rankedIds.has(id))
      .map((id) => ({ id, sources: ["phrase"] })),
  ].slice(0, limit);
  if (merged.length === 0) return [];

  // Full-text search computes its own OCR headline; seed from it so items that
  // matched on OCR text via full-text (and fall outside the separately-limited
  // OCR results) keep a snippet, then let the dedicated OCR snippet win on overlap.
  const ocrSnippets = new Map<string, string>();
  for (const r of textResults) {
    if (r.ocrSnippet) ocrSnippets.set(r.id, r.ocrSnippet);
  }
  for (const r of ocrResults) {
    ocrSnippets.set(r.id, r.snippet);
  }

  const vectorSimilarities = new Map(
    vectorResults.map((r) => [r.id, r.similarity]),
  );

  return merged.map((result) => ({
    id: result.id,
    sources: result.sources,
    ocrSnippet: ocrSnippets.get(result.id) ?? null,
    vectorSimilarity: vectorSimilarities.get(result.id) ?? null,
  }));
}
