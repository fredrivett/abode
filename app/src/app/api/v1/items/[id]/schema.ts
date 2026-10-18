import { z } from "zod";
import { articleReadingSchema } from "@/lib/items/article-reading-status";
import { bookReadingSchema } from "@/lib/items/book-reading-status";
import { ITEM_PRIVACY_LEVELS } from "@/lib/items/privacy";
import {
  MAX_USER_TAG_LENGTH,
  MAX_USER_TAGS,
  USER_TAG_REGEX,
} from "@/lib/items/user-tag-validation";

// Generous ceiling for a user-edited title — guards against abuse without
// rejecting any realistic page title
export const MAX_ITEM_TITLE_LENGTH = 1000;

// The full set of user-editable fields. Anything else in the body (storage
// keys, processing state, AI tags, source URL) is server-owned and stripped —
// accepting it would let a caller point their item at another user's files.
export const itemPatchSchema = z.object({
  title: z.string().trim().min(1).max(MAX_ITEM_TITLE_LENGTH).optional(),
  privacy: z.enum(ITEM_PRIVACY_LEVELS).optional(),
  notes: z.string().nullable().optional(),
  shared: z.boolean().optional(),
  sharedHighlights: z.boolean().optional(),
  coverHidden: z.boolean().optional(),
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
  // Per-kind (book) reading lifecycle. Routed to itemBookDetails by the handler.
  bookReading: bookReadingSchema.optional(),
  // Per-kind (article) read status + scroll progress. Routed to
  // itemArticleDetails by the handler.
  articleReading: articleReadingSchema.optional(),
});
