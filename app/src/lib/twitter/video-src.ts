import type { TwitterMedia } from "@/components/twitter/types";

export type TwitterVideoQuality = "highest" | "lowest";

/**
 * Pick an mp4 variant for a tweet's video media and return a proxied URL.
 *
 * `highest` bitrate suits the detail view; `lowest` suits in-feed autoplay
 * where bandwidth matters more than fidelity.
 *
 * The proxy is item-scoped: the caller must pass the owning item's id so the
 * route can confirm the requester may access that item and that the requested
 * variant actually belongs to it — otherwise the endpoint would be an open
 * media proxy (see `/api/v1/twitter-video`).
 */
export function getTwitterVideoSrc({
  media,
  quality,
  itemId,
}: {
  media: TwitterMedia;
  quality: TwitterVideoQuality;
  itemId: string;
}): string | undefined {
  const variants = media.variants ?? [];
  const mp4s = variants.filter((v) => v.type === "video/mp4");
  const sorted = [...(mp4s.length > 0 ? mp4s : variants)].sort((a, b) =>
    quality === "highest"
      ? (b.bitrate ?? 0) - (a.bitrate ?? 0)
      : (a.bitrate ?? 0) - (b.bitrate ?? 0),
  );
  const src = sorted[0]?.src;
  if (!src) return undefined;
  return `/api/v1/twitter-video?itemId=${encodeURIComponent(itemId)}&url=${encodeURIComponent(src)}`;
}
