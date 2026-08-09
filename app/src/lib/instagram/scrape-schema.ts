import { z } from "zod";
import type { InstagramDetails } from "@/lib/types/item";

const mediaSchema = z.object({
  type: z.enum(["photo", "video"]),
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  posterUrl: z.string().url().optional(),
});

/**
 * Full media + metadata the browser extension scrapes off a logged-in Instagram
 * post page for a direct save. Unlike the enrich endpoint's payload this carries
 * `postId`/`mediaType` (a fresh item has no details row to read them from).
 */
export const instagramScrapeSchema = z.object({
  postId: z.string().min(1),
  mediaType: z.enum(["post", "reel", "tv"]),
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

export type InstagramScrapeInput = z.infer<typeof instagramScrapeSchema>;

/** Build the full InstagramDetails the enrich task persists from a scrape. */
export function scrapeToDetails(input: InstagramScrapeInput): InstagramDetails {
  return {
    postId: input.postId,
    mediaType: input.mediaType,
    authorName: input.authorName ?? null,
    authorUsername: input.authorUsername,
    caption: input.caption ?? null,
    postedAt: input.postedAt ?? null,
    media: input.media,
    likeCount: input.likeCount ?? null,
    commentCount: input.commentCount ?? null,
    coverMediaIndex: input.coverMediaIndex ?? 0,
  };
}
