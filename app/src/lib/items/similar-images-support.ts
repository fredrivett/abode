import type { ItemKind } from "@prisma/client";

/**
 * Whether an item carries a visual embedding that similar-images can seed from.
 * Plain image uploads have one, and tweets do too now that the selected cover's
 * embedding is mirrored into item_visual_vectors. Other kinds don't surface
 * similar-images today.
 */
export function supportsSimilarImages(
  kind: ItemKind | null | undefined,
): boolean {
  return kind === "image" || kind === "twitter";
}
