import type { ItemKind } from "@prisma/client";

/**
 * Kinds whose `item_image_details.blur_data_url` is written directly from the
 * item's own image (`file_key` for uploads, `cover_file_key` for cover kinds),
 * so `backfill-blur-placeholders` can regenerate it in place.
 *
 * Excludes the media/mirror kinds (twitter, instagram): their item-level blur is
 * MIRRORED from `item_media_analysis` by `mirrorCoverAnalysisToItem`, so writing
 * it directly would be non-durable (the next re-mirror overwrites it) and could
 * blur a different file than the selected cover. A media-aware blur backfill for
 * those is a separate follow-up. (video/note never get an image-details row.)
 *
 * Shared by the `missing-blur` issue group and the backfill task so the group
 * only ever contains items the task can actually heal.
 */
export const BLUR_HEALABLE_KINDS = [
  "image",
  "article",
  "webpage",
  "product",
  "book",
] as const satisfies readonly ItemKind[];
