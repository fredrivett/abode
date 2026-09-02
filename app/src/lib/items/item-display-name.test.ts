import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/types/item";
import { getItemDisplayName } from "./item-display-name";

const item = (overrides: Partial<Item>): Item => overrides as Item;

describe("getItemDisplayName", () => {
  it("uses the title when present", () => {
    expect(getItemDisplayName(item({ title: "My Item" }))).toBe("My Item");
  });

  it("falls back to Untitled when there's no title", () => {
    expect(getItemDisplayName(item({ title: null }))).toBe("Untitled");
  });

  it("shows the domain for a processing URL with no title yet", () => {
    expect(
      getItemDisplayName(
        item({
          title: null,
          sourceType: "url",
          processingStatus: "processing",
          sourceUrl: "https://example.com/some/path",
        }),
      ),
    ).toBe("example.com");
  });

  it("prefers an explicit title over the processing-URL domain", () => {
    expect(
      getItemDisplayName(
        item({
          title: "Real Title",
          sourceType: "url",
          processingStatus: "processing",
          sourceUrl: "https://example.com",
        }),
      ),
    ).toBe("Real Title");
  });

  it("uses the first line of a title-less note", () => {
    expect(
      getItemDisplayName(
        item({
          title: null,
          kind: "note",
          noteDetails: { content: "First line\n\nmore" },
        }),
      ),
    ).toBe("First line");
  });
});
