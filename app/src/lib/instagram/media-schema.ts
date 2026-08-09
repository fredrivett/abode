import { z } from "zod";

/** One scraped media item (a photo, or a video with its poster still). */
export const instagramMediaSchema = z.object({
  type: z.enum(["photo", "video"]),
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  posterUrl: z.string().url().optional(),
});

/**
 * Fields common to both the enrich payload and the direct-save scrape payload.
 * Shared so the two request shapes can't silently diverge as Instagram evolves.
 * `postId`/`mediaType` are added by the scrape schema only (a fresh item has no
 * details row to read them from).
 */
export const instagramMediaFields = {
  authorName: z.string().nullable().optional(),
  authorUsername: z.string().min(1),
  caption: z.string().nullable().optional(),
  postedAt: z.string().datetime().nullable().optional(),
  likeCount: z.number().int().nonnegative().nullable().optional(),
  commentCount: z.number().int().nonnegative().nullable().optional(),
  // Instagram carousels hold at most 10; allow headroom but cap to bound work.
  media: z.array(instagramMediaSchema).min(1).max(20),
  coverMediaIndex: z.number().int().nonnegative().optional(),
};

/** A cover index must point at an actual media slide. */
export function coverIndexInRange(value: {
  media: unknown[];
  coverMediaIndex?: number;
}): boolean {
  return (
    value.coverMediaIndex === undefined ||
    value.coverMediaIndex < value.media.length
  );
}

export const coverIndexIssue = {
  message: "coverMediaIndex is out of range",
  path: ["coverMediaIndex"],
};
