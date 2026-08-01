import { z } from "zod";

// User tags may contain letters, numbers, spaces, hyphens, and underscores
const userTagRegex = /^[\w\s-]+$/u;

// Validates only the fields that previously had explicit hand-rolled checks in
// the PATCH handler. The remaining updatable fields (processingStatus, fileKey,
// meta, sourceType, sourceUrl, coverFileKey, excludeFromPublicRooms, tags,
// title) never had validation and continue to pass through unchanged from the
// raw body — so they are intentionally omitted here.
export const itemPatchSchema = z.object({
  notes: z.string().nullable().optional(),
  shared: z.boolean().optional(),
  sharedHighlights: z.boolean().optional(),
  content: z.string().optional(),
  twitterCoverMediaIndex: z.number().int().nonnegative().nullable().optional(),
  productCoverImageIndex: z.number().int().nonnegative().nullable().optional(),
  userTags: z
    .array(z.string().min(1).max(50).regex(userTagRegex))
    .max(100)
    .optional(),
});
