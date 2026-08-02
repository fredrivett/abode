import { z } from "zod";
import {
  MAX_USER_TAG_LENGTH,
  MAX_USER_TAGS,
  USER_TAG_REGEX,
} from "@/lib/items/user-tag-validation";

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
    .array(
      z
        .string()
        .min(1)
        .max(MAX_USER_TAG_LENGTH)
        .regex(USER_TAG_REGEX)
        .refine((t) => t.trim().length > 0, "Tag cannot be only whitespace"),
    )
    .max(MAX_USER_TAGS)
    .optional(),
});
