type ResolveSimilarImageCoverArgs = {
  /** The item's primary file key (set for single-image kinds). */
  fileKey: string | null;
  /** User-selected cover for multi-image kinds; null when there's no override. */
  coverFileKey: string | null;
  /** LQIP from ItemImageDetails (single-image kinds). */
  imageDetailsBlurDataUrl: string | null | undefined;
  /** Per-image analysis rows (multi-image kinds), each keyed by its file. */
  mediaAnalyses: Array<{ fileKey: string; blurDataUrl: string | null }>;
};

type SimilarImageCover = {
  fileKey: string | null;
  blurDataUrl: string | null;
};

/**
 * Resolve the thumbnail + its blur-up LQIP for a similar-images result.
 *
 * The visual vector that produced the match is computed on the item's cover, so
 * the thumbnail and its blur must follow `coverFileKey` — for a multi-image item
 * (e.g. a tweet) that's a user-selected image that can differ from `fileKey`.
 * Single-image items have no cover override and fall back to `fileKey`.
 *
 * The two blur sources cover disjoint kinds. Multi-image items (any with media
 * analyses) carry the authoritative per-file LQIP keyed by file and re-written
 * on a cover swap, so use only the row matching the cover — if it's missing
 * (e.g. a freshly-selected cover whose analysis is still pending) return no
 * LQIP rather than the item's single, unkeyed `imageDetails` value, which could
 * be a stale prior cover's blur. `imageDetails` is the source only for
 * single-image kinds, which have no media analyses at all.
 */
export function resolveSimilarImageCover({
  fileKey,
  coverFileKey,
  imageDetailsBlurDataUrl,
  mediaAnalyses,
}: ResolveSimilarImageCoverArgs): SimilarImageCover {
  const cover = coverFileKey ?? fileKey;
  const blurDataUrl =
    mediaAnalyses.length > 0
      ? (mediaAnalyses.find((m) => m.fileKey === cover)?.blurDataUrl ?? null)
      : (imageDetailsBlurDataUrl ?? null);
  return { fileKey: cover, blurDataUrl };
}
