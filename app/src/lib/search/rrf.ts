/**
 * Reciprocal Rank Fusion (RRF) for merging search results.
 *
 * Formula: score = Σ 1/(k + rank)
 * where k is a constant (default 60) that controls how much high ranks are favored.
 *
 * Items appearing in multiple result sets get boosted naturally.
 */

export type RankedItem<T> = {
  item: T;
  rank: number;
  sources: string[];
};

export type RRFOptions = {
  k?: number; // Ranking constant, default 60
  limit?: number; // Max results to return
};

/**
 * Merge multiple ranked result sets using Reciprocal Rank Fusion.
 *
 * @param resultSets - Map of source name to array of item IDs in rank order
 * @param options - RRF configuration options
 * @returns Array of item IDs sorted by RRF score
 */
export function reciprocalRankFusion(
  resultSets: Map<string, string[]>,
  options: RRFOptions = {},
): { id: string; score: number; sources: string[] }[] {
  const k = options.k ?? 60;
  const limit = options.limit ?? 100;

  // Calculate RRF scores
  const scores = new Map<string, { score: number; sources: Set<string> }>();

  for (const [source, ids] of resultSets) {
    for (let rank = 0; rank < ids.length; rank++) {
      const id = ids[rank];
      const rrfScore = 1 / (k + rank + 1); // rank is 0-indexed, RRF uses 1-indexed

      const existing = scores.get(id);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.add(source);
      } else {
        scores.set(id, { score: rrfScore, sources: new Set([source]) });
      }
    }
  }

  // Sort by score descending and limit
  const sorted = Array.from(scores.entries())
    .map(([id, { score, sources }]) => ({
      id,
      score,
      sources: Array.from(sources),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return sorted;
}

/**
 * Merge full-text and vector search results using RRF.
 *
 * @param textResults - Full-text search results (id, rank)
 * @param vectorResults - Vector search results (id, similarity)
 * @param options - RRF options
 * @returns Merged results with source tracking
 */
export function mergeSearchResults(
  textResults: Array<{ id: string; rank?: number }>,
  vectorResults: Array<{ id: string; similarity?: number }>,
  options: RRFOptions = {},
): { id: string; score: number; sources: string[] }[] {
  const resultSets = new Map<string, string[]>();

  // Full-text results (already in rank order)
  if (textResults.length > 0) {
    resultSets.set(
      "fulltext",
      textResults.map((r) => r.id),
    );
  }

  // Vector results (already in similarity order)
  if (vectorResults.length > 0) {
    resultSets.set(
      "vector",
      vectorResults.map((r) => r.id),
    );
  }

  return reciprocalRankFusion(resultSets, options);
}
