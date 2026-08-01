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
 * mediaAnalyses is the authoritative per-file LQIP (keyed by file, re-written on
 * a cover swap), so match it on the cover first; imageDetails is a single
 * unkeyed field that can go stale after a swap, so it's only the fallback for
 * kinds without a media row.
 */
export function resolveSimilarImageCover({
  fileKey,
  coverFileKey,
  imageDetailsBlurDataUrl,
  mediaAnalyses,
}: ResolveSimilarImageCoverArgs): SimilarImageCover {
  const cover = coverFileKey ?? fileKey;
  const blurDataUrl =
    mediaAnalyses.find((m) => m.fileKey === cover)?.blurDataUrl ??
    imageDetailsBlurDataUrl ??
    null;
  return { fileKey: cover, blurDataUrl };
}
