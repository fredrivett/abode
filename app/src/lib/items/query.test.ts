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
});

describe("transformItem", () => {
  const baseRawItem = {
    id: "item-1",
    kind: null,
    processingStatus: "failed",
    processingError: "source_blocked",
    fileKey: null,
    meta: null,
    sourceType: "url",
    sourceUrl: "https://example.com",
    coverFileKey: null,
    createdAt: new Date("2026-07-24T18:43:37.000Z"),
    title: null,
    description: null,
    tags: [],
    userTags: [],
    notes: null,
    excludeFromPublicRooms: false,
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
});
