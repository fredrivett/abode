import { describe, expect, it } from "vitest";
import { itemSelect, type RawItem, transformItem } from "./query";

/**
 * Guards the regression where `processingError` was classified and stored but
 * dropped from the shared select, so the grid/list (and the detail dialog that
 * reads off that prop) always saw `undefined` and showed generic copy.
 */
describe("itemSelect", () => {
  it("selects processingError so failure reasons reach the client", () => {
    expect(itemSelect.processingError).toBe(true);
  });

  /**
   * Guards the drift where the single-item route (`/api/v1/items/[id]`)
   * hand-rolled a narrower select than the list route, dropping these detail
   * relations so GET-by-id and GET-list returned different shapes. Both routes
   * now share this select, so it must carry every detail relation.
   */
  it("selects all detail relations so single-item and list shapes match", () => {
    expect(itemSelect.twitterDetails).toBeTruthy();
    expect(itemSelect.videoDetails).toBeTruthy();
    expect(itemSelect.productDetails).toBeTruthy();
    expect(itemSelect.bookDetails).toBeTruthy();
    expect(itemSelect.articleDetails).toBeTruthy();
    expect(itemSelect.noteDetails).toBeTruthy();
    expect(itemSelect.externalLinks).toBe(true);
  });
});

describe("transformItem", () => {
  const baseRawItem = {
    id: "item-1",
    userId: "user-1",
    kind: null,
    processingStatus: "failed",
    processingError: "source_blocked",
    fileKey: null,
    meta: null,
    sourceType: "url",
    sourceUrl: "https://example.com",
    coverFileKey: null,
    createdAt: new Date("2026-07-24T18:43:37.000Z"),
    updatedAt: new Date("2026-07-25T09:15:00.000Z"),
    title: null,
    description: null,
    tags: [],
    userTags: [],
    notes: null,
    excludeFromPublicRooms: false,
    coverHidden: false,
    sharedAt: null,
    sharedHighlights: false,
    locations: [],
    imageDetails: null,
    roomItems: [],
    externalLinks: [],
    articleDetails: null,
    twitterDetails: null,
    videoDetails: null,
    productDetails: null,
    bookDetails: null,
    noteDetails: null,
  } as unknown as RawItem;

  it("passes processingError through to the client shape", () => {
    expect(transformItem(baseRawItem).processingError).toBe("source_blocked");
  });

  it("carries a null processingError for non-failed items", () => {
    const result = transformItem({
      ...baseRawItem,
      processingStatus: "completed",
      processingError: null,
    } as unknown as RawItem);
    expect(result.processingError).toBeNull();
  });

  it("exposes userId and ISO timestamps for parity with the single-item route", () => {
    const result = transformItem(baseRawItem);
    expect(result.userId).toBe("user-1");
    expect(result.createdAt).toBe("2026-07-24T18:43:37.000Z");
    expect(result.updatedAt).toBe("2026-07-25T09:15:00.000Z");
  });

  /**
   * Parity guard: the single-item route once dropped these relations, so a null
   * detail must survive transform as an explicit null (not `undefined`) and a
   * populated one must be flattened to the client shape.
   */
  it("carries null detail relations through as null", () => {
    const result = transformItem(baseRawItem);
    expect(result.twitterDetails).toBeNull();
    expect(result.videoDetails).toBeNull();
    expect(result.productDetails).toBeNull();
    expect(result.bookDetails).toBeNull();
    expect(result.articleDetails).toBeNull();
    expect(result.externalLinks).toEqual([]);
  });

  it("flattens populated twitter/video/product/book details to the client shape", () => {
    const result = transformItem({
      ...baseRawItem,
      externalLinks: [{ url: "https://example.com", title: "Example" }],
      twitterDetails: {
        tweetId: "t1",
        authorName: "Ada",
        authorUsername: "ada",
        authorAvatarUrl: null,
        text: "hello",
        postedAt: new Date("2026-07-20T00:00:00.000Z"),
        media: null,
        quotedTweetId: null,
        card: null,
        coverMediaIndex: 0,
      },
      videoDetails: {
        platform: "youtube",
        videoId: "v1",
        channelName: "Chan",
        channelUrl: null,
        duration: 120,
        embedUrl: null,
        thumbnailUrl: null,
      },
      productDetails: {
        domain: "shop.example.com",
        brand: "Acme",
        price: "10",
        currency: "USD",
        availability: null,
        images: null,
        coverImageIndex: 0,
      },
      bookDetails: {
        authors: ["Ada"],
        publisher: "Pub",
        publishedAt: new Date("2020-01-01T00:00:00.000Z"),
        isbn: "123",
        pageCount: 300,
        domain: "books.example.com",
      },
    } as unknown as RawItem);

    expect(result.twitterDetails?.tweetId).toBe("t1");
    expect(result.twitterDetails?.postedAt).toBe("2026-07-20T00:00:00.000Z");
    expect(result.videoDetails?.platform).toBe("youtube");
    expect(result.productDetails?.brand).toBe("Acme");
    expect(result.bookDetails?.publishedAt).toBe("2020-01-01T00:00:00.000Z");
    expect(result.externalLinks).toHaveLength(1);
  });
});
