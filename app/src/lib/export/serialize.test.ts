import { describe, expect, it } from "vitest";
import { itemRow } from "./__tests__/fixtures";
import {
  roomFilterStrings,
  toExportItem,
  toExportNoteDraft,
  withoutStorageInternals,
} from "./serialize";

describe("withoutStorageInternals", () => {
  it("drops storage keys and blur placeholders at any depth, keeping the rest", () => {
    expect(
      withoutStorageInternals([
        {
          type: "photo",
          url: "https://x/1",
          fileKey: "u/1.jpg",
          blurDataUrl: "data:image/png;base64,AAAA",
          nested: { imageFileKey: "u/2.jpg", width: 10 },
        },
      ]),
    ).toEqual([{ type: "photo", url: "https://x/1", nested: { width: 10 } }]);
  });
});

describe("toExportItem", () => {
  it("renames AI tags, keeps only meaningful meta, and strips keys from media", () => {
    const item = toExportItem(
      itemRow({
        kind: "twitter",
        tags: ["ai"],
        userTags: ["mine"],
        meta: {
          originalName: "a.jpg",
          size: 10,
          blurDataUrl: "data:…",
          aspectHint: 1.5,
        },
        twitterDetails: {
          tweetId: "1",
          authorName: "A",
          authorUsername: "a",
          authorAvatarUrl: null,
          text: "hello",
          postedAt: null,
          media: [{ type: "photo", url: "https://x/1", fileKey: "u/1.jpg" }],
          quotedTweetId: null,
          card: { url: "https://ex.com", imageFileKey: "u/c.jpg" },
          coverMediaIndex: 0,
        },
      }),
    );

    expect(item.aiTags).toEqual(["ai"]);
    expect(item.userTags).toEqual(["mine"]);
    expect(item).not.toHaveProperty("tags");
    expect(item.meta).toEqual({ originalName: "a.jpg", size: 10 });
    expect(item.twitter?.media).toEqual([
      { type: "photo", url: "https://x/1" },
    ]);
    expect(item.twitter?.card).toEqual({ url: "https://ex.com" });
  });

  it("groups document pages and leaves absent details null", () => {
    const pages = [
      {
        position: 0,
        filter: "bw" as const,
        width: 1,
        height: 2,
        ocrText: "p1",
      },
    ];
    const item = toExportItem(
      itemRow({ kind: "document", documentPages: pages }),
    );
    expect(item.document).toEqual({ pages });
    expect(item.article).toBeNull();
    expect(toExportItem(itemRow()).document).toBeNull();
  });

  it("never serializes a storage key anywhere in the item", () => {
    const json = JSON.stringify(
      toExportItem(
        itemRow({
          productDetails: {
            domain: "shop.com",
            brand: null,
            price: "10",
            currency: "GBP",
            availability: null,
            images: [{ fileKey: "u/p.jpg", url: "https://shop/p.jpg" }],
            coverImageIndex: 0,
          },
        }),
      ),
    );
    expect(json).not.toMatch(/fileKey/i);
  });
});

describe("roomFilterStrings", () => {
  it("serializes smart-room filters to search-box syntax, skipping junk", () => {
    expect(
      roomFilterStrings([
        { id: "a", type: "tag", value: "design", negated: false },
        { id: "b", type: "status", value: "read", negated: true },
        { nonsense: true },
      ]),
    ).toEqual(["@tag:design", "-@status:read"]);
  });

  it("returns nothing for missing or malformed filters", () => {
    expect(roomFilterStrings(null)).toEqual([]);
    expect(roomFilterStrings({ type: "tag" })).toEqual([]);
  });
});

describe("toExportNoteDraft", () => {
  it("drops an empty draft", () => {
    const at = new Date();
    expect(
      toExportNoteDraft({ content: "  ", createdAt: at, updatedAt: at }),
    ).toBeNull();
    expect(toExportNoteDraft(null)).toBeNull();
  });
});
