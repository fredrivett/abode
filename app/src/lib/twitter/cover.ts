import type { TwitterMedia } from "@/lib/types/item";

/**
 * The re-hosted storage key of a tweet's selected cover image, or null when
 * that image isn't re-hosted (e.g. a video whose poster failed to host, or a
 * pre-re-hosting tweet). A null `coverMediaIndex` defaults to the first media.
 *
 * This is the image search + similar-images should follow, so it drives both
 * `item.coverFileKey` and the analyse-cover trigger on a cover swap.
 */
export function resolveTweetCoverFileKey(
  media: TwitterMedia[] | null | undefined,
  coverMediaIndex: number | null | undefined,
): string | null {
  if (!media || media.length === 0) return null;
  return media[coverMediaIndex ?? 0]?.fileKey ?? null;
}
