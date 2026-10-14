import { describe, expect, it } from "vitest";
import { itemPatchSchema, MAX_ITEM_TITLE_LENGTH } from "./schema";

describe("itemPatchSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(itemPatchSchema.safeParse({}).success).toBe(true);
  });

  it("strips server-owned fields rather than accepting them", () => {
    const result = itemPatchSchema.safeParse({
      processingStatus: "completed",
      fileKey: "someone-else/photo.jpg",
      coverFileKey: "someone-else/cover.jpg",
      sourceUrl: "https://example.com",
      sourceType: "url",
      meta: { size: 1 },
      tags: ["a", "b"],
      whatever: 123,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  describe("title", () => {
    it("accepts a title, trimmed", () => {
      expect(itemPatchSchema.parse({ title: "  Hello  " }).title).toBe("Hello");
    });

    it("rejects empty, whitespace-only, over-long and non-string titles", () => {
      for (const title of [
        "",
        "   ",
        "a".repeat(MAX_ITEM_TITLE_LENGTH + 1),
        null,
        5,
      ]) {
        expect(itemPatchSchema.safeParse({ title }).success).toBe(false);
      }
    });

    it("accepts a title at the length limit", () => {
      expect(
        itemPatchSchema.safeParse({ title: "a".repeat(MAX_ITEM_TITLE_LENGTH) })
          .success,
      ).toBe(true);
    });
  });

  describe("excludeFromPublicRooms", () => {
    it("accepts booleans and rejects anything else", () => {
      expect(
        itemPatchSchema.safeParse({ excludeFromPublicRooms: true }).success,
      ).toBe(true);
      expect(
        itemPatchSchema.safeParse({ excludeFromPublicRooms: "yes" }).success,
      ).toBe(false);
      expect(
        itemPatchSchema.safeParse({ excludeFromPublicRooms: null }).success,
      ).toBe(false);
    });
  });

  describe("notes", () => {
    it("accepts string, null, and undefined", () => {
      expect(itemPatchSchema.safeParse({ notes: "hi" }).success).toBe(true);
      expect(itemPatchSchema.safeParse({ notes: null }).success).toBe(true);
      expect(itemPatchSchema.safeParse({ notes: undefined }).success).toBe(
        true,
      );
    });

    it("rejects non-string, non-null values", () => {
      expect(itemPatchSchema.safeParse({ notes: 5 }).success).toBe(false);
      expect(itemPatchSchema.safeParse({ notes: {} }).success).toBe(false);
    });
  });

  describe("shared / sharedHighlights", () => {
    it("accepts booleans", () => {
      expect(itemPatchSchema.safeParse({ shared: true }).success).toBe(true);
      expect(
        itemPatchSchema.safeParse({ sharedHighlights: false }).success,
      ).toBe(true);
    });

    it("rejects non-booleans (including null)", () => {
      expect(itemPatchSchema.safeParse({ shared: "true" }).success).toBe(false);
      expect(itemPatchSchema.safeParse({ shared: null }).success).toBe(false);
      expect(itemPatchSchema.safeParse({ sharedHighlights: 1 }).success).toBe(
        false,
      );
    });
  });

  describe("content", () => {
    it("accepts a string", () => {
      expect(itemPatchSchema.safeParse({ content: "body" }).success).toBe(true);
    });

    it("rejects null (unlike notes) and non-strings", () => {
      expect(itemPatchSchema.safeParse({ content: null }).success).toBe(false);
      expect(itemPatchSchema.safeParse({ content: 42 }).success).toBe(false);
    });
  });

  describe.each(["twitterCoverMediaIndex", "productCoverImageIndex"] as const)(
    "%s",
    (field) => {
      it("accepts a non-negative integer, null, and undefined", () => {
        expect(itemPatchSchema.safeParse({ [field]: 0 }).success).toBe(true);
        expect(itemPatchSchema.safeParse({ [field]: 3 }).success).toBe(true);
        expect(itemPatchSchema.safeParse({ [field]: null }).success).toBe(true);
        expect(itemPatchSchema.safeParse({ [field]: undefined }).success).toBe(
          true,
        );
      });

      it("rejects negative, non-integer, and non-number values", () => {
        expect(itemPatchSchema.safeParse({ [field]: -1 }).success).toBe(false);
        expect(itemPatchSchema.safeParse({ [field]: 1.5 }).success).toBe(false);
        expect(itemPatchSchema.safeParse({ [field]: "1" }).success).toBe(false);
        expect(itemPatchSchema.safeParse({ [field]: Number.NaN }).success).toBe(
          false,
        );
      });
    },
  );

  describe("userTags", () => {
    it("accepts an array of valid tags and an empty array", () => {
      expect(
        itemPatchSchema.safeParse({ userTags: ["hello", "a-b_c 1"] }).success,
      ).toBe(true);
      expect(itemPatchSchema.safeParse({ userTags: [] }).success).toBe(true);
    });

    it("accepts up to 100 tags but rejects more", () => {
      const many = Array.from({ length: 100 }, (_, i) => `tag${i}`);
      expect(itemPatchSchema.safeParse({ userTags: many }).success).toBe(true);
      expect(
        itemPatchSchema.safeParse({ userTags: [...many, "extra"] }).success,
      ).toBe(false);
    });

    it("rejects a non-array", () => {
      expect(itemPatchSchema.safeParse({ userTags: "nope" }).success).toBe(
        false,
      );
    });

    it("rejects empty, over-long, and disallowed-character tags", () => {
      expect(itemPatchSchema.safeParse({ userTags: [""] }).success).toBe(false);
      expect(
        itemPatchSchema.safeParse({ userTags: ["a".repeat(51)] }).success,
      ).toBe(false);
      expect(itemPatchSchema.safeParse({ userTags: ["bad!"] }).success).toBe(
        false,
      );
      expect(itemPatchSchema.safeParse({ userTags: ["emoji😀"] }).success).toBe(
        false,
      );
    });

    it("rejects control whitespace and whitespace-only tags", () => {
      expect(
        itemPatchSchema.safeParse({ userTags: ["line1\nline2"] }).success,
      ).toBe(false);
      expect(itemPatchSchema.safeParse({ userTags: ["a\tb"] }).success).toBe(
        false,
      );
      expect(itemPatchSchema.safeParse({ userTags: ["   "] }).success).toBe(
        false,
      );
    });

    it("accepts a 50-character tag (boundary)", () => {
      expect(
        itemPatchSchema.safeParse({ userTags: ["a".repeat(50)] }).success,
      ).toBe(true);
    });

    it("rejects non-string tag elements", () => {
      expect(itemPatchSchema.safeParse({ userTags: [1] }).success).toBe(false);
    });
  });

  describe("bookReading", () => {
    it("accepts a valid reading patch (nested group)", () => {
      expect(
        itemPatchSchema.safeParse({
          bookReading: { status: "reading", progressValue: 40 },
        }).success,
      ).toBe(true);
    });

    it("rejects an invalid reading patch (bad status)", () => {
      expect(
        itemPatchSchema.safeParse({ bookReading: { status: "abandoned" } })
          .success,
      ).toBe(false);
    });

    it("rejects a finished date before the started date within one body", () => {
      expect(
        itemPatchSchema.safeParse({
          bookReading: {
            startedAt: "2026-08-01T00:00:00.000Z",
            finishedAt: "2026-07-01T00:00:00.000Z",
          },
        }).success,
      ).toBe(false);
    });
  });
});
