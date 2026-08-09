import { z } from "zod";
import {
  coverIndexInRange,
  coverIndexIssue,
  instagramMediaFields,
} from "@/lib/instagram/media-schema";
import type { InstagramDetails } from "@/lib/types/item";

/**
 * Full media + metadata the browser extension scrapes off a logged-in Instagram
 * post page for a direct save. Unlike the enrich endpoint's payload this carries
 * `postId`/`mediaType` (a fresh item has no details row to read them from).
 */
export const instagramScrapeSchema = z
  .object({
    postId: z.string().min(1),
    mediaType: z.enum(["post", "reel", "tv"]),
    ...instagramMediaFields,
  })
  .refine(coverIndexInRange, coverIndexIssue);

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
