import type { ItemKind } from "@prisma/client";

/**
 * Whether a grid card already has kind-specific content to render, so the
 * generic "processing"/"failed" URL placeholders must not swallow it.
 *
 * Twitter/instagram/video keep their thumbnail in `coverFileKey` (never
 * `fileKey`), so the card's `previewUrl` is always null for them — yet their
 * detail rows land mid-processing, before enrichment marks the item
 * `completed`. Without this gate the placeholder hides that content for the
 * whole processing window. Notes always render their own card (and are created
 * already `completed`, so never hit the placeholder in practice).
 *
 * Exhaustive over `ItemKind`: a new kind is a compile error here until it's
 * classified, so this can't silently drift as card types are added.
 */
export function hasKindSpecificCardContent(params: {
  kind: ItemKind | null;
  hasTwitterDetails: boolean;
  hasInstagramDetails: boolean;
  hasVideoDetails: boolean;
}): boolean {
  const { kind, hasTwitterDetails, hasInstagramDetails, hasVideoDetails } =
    params;
  switch (kind) {
    case "twitter":
      return hasTwitterDetails;
    case "instagram":
      return hasInstagramDetails;
    case "video":
      return hasVideoDetails;
    case "note":
      return true;
    // Shown via previewUrl/coverFileKey (or no early card), so the generic
    // placeholder gate is already correct without this override.
    case "image":
    case "article":
    case "webpage":
    case "product":
    case "book":
    case null:
      return false;
    default:
      // Compile error if a new ItemKind isn't handled above; runtime-safe.
      kind satisfies never;
      return false;
  }
}
