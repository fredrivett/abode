import type { ItemKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { supportsSimilarImages } from "./similar-images-support";

describe("supportsSimilarImages", () => {
  it.each<ItemKind>(["image", "twitter"])(
    "enables similar-images for %s items (they have a visual vector)",
    (kind) => {
      expect(supportsSimilarImages(kind)).toBe(true);
    },
  );

  it.each<ItemKind>(["article", "video", "product", "book", "note", "webpage"])(
    "does not surface similar-images for %s items",
    (kind) => {
      expect(supportsSimilarImages(kind)).toBe(false);
    },
  );

  it("handles a null/unclassified kind", () => {
    expect(supportsSimilarImages(null)).toBe(false);
  });
});
