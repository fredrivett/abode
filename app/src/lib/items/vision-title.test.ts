import type { ItemKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { visionOwnsTitle } from "./vision-title";

describe("visionOwnsTitle", () => {
  it("lets vision own the title for plain image uploads", () => {
    expect(visionOwnsTitle("image")).toBe(true);
  });

  it.each<ItemKind>([
    "article",
    "twitter",
    "video",
    "product",
    "book",
    "note",
    "webpage",
  ])("does not let vision clobber the title for %s items", (kind) => {
    expect(visionOwnsTitle(kind)).toBe(false);
  });

  it("does not let vision own the title for an unclassified (null) kind", () => {
    expect(visionOwnsTitle(null)).toBe(false);
  });
});
