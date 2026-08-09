import { z } from "zod";
import {
  coverIndexInRange,
  coverIndexIssue,
  instagramMediaFields,
} from "@/lib/instagram/media-schema";

/**
 * The payload the browser extension posts after scraping a post's full media.
 * `postId`/`mediaType` are NOT accepted here — they're immutable for a given
 * item and read from the existing details row, so a payload can't repoint them.
 */
export const instagramEnrichSchema = z
  .object({ ...instagramMediaFields })
  .refine(coverIndexInRange, coverIndexIssue);

export type InstagramEnrichInput = z.infer<typeof instagramEnrichSchema>;
