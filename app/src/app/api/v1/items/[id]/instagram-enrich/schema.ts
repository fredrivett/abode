import { z } from "zod";

const mediaSchema = z.object({
  type: z.enum(["photo", "video"]),
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  posterUrl: z.string().url().optional(),
});

/**
 * The payload the browser extension posts after scraping a post's full media.
 * `postId`/`mediaType` are NOT accepted here — they're immutable for a given
 * item and read from the existing details row, so a payload can't repoint them.
 */
export const instagramEnrichSchema = z.object({
  authorName: z.string().nullable().optional(),
  authorUsername: z.string().min(1),
  caption: z.string().nullable().optional(),
  postedAt: z.string().datetime().nullable().optional(),
  likeCount: z.number().int().nonnegative().nullable().optional(),
  commentCount: z.number().int().nonnegative().nullable().optional(),
  // Instagram carousels hold at most 10; allow headroom but cap to bound work.
  media: z.array(mediaSchema).min(1).max(20),
  coverMediaIndex: z.number().int().nonnegative().optional(),
});

export type InstagramEnrichInput = z.infer<typeof instagramEnrichSchema>;
