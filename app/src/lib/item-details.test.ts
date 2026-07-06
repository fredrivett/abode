import { describe, expect, it } from "vitest";
import { staleDetailModelsForKind } from "./item-details";

describe("staleDetailModelsForKind", () => {
  it("keeps only the article table for articles", () => {
    const stale = staleDetailModelsForKind("article");
    expect(stale).not.toContain("itemArticleDetails");
    expect(stale).toContain("itemProductDetails");
    expect(stale).toContain("itemImageDetails");
  });

  it("prunes article details when reclassifying article → product", () => {
    // The reported case: an item first classified as an article that now
    // classifies as a product must not keep its stale article row.
    const stale = staleDetailModelsForKind("product");
    expect(stale).toContain("itemArticleDetails");
  });

  it("keeps image details for kinds whose cover is visually analysed", () => {
    // book/product covers are sent to analyze-image, which writes image details
    expect(staleDetailModelsForKind("product")).not.toContain(
      "itemImageDetails",
    );
    expect(staleDetailModelsForKind("book")).not.toContain("itemImageDetails");
  });

  it("prunes image details when leaving an image-owning kind", () => {
    // product → article: the old cover's image analysis is no longer relevant
    expect(staleDetailModelsForKind("article")).toContain("itemImageDetails");
  });

  it("prunes every detail table for a webpage (owns none)", () => {
    const stale = staleDetailModelsForKind("webpage");
    expect(stale).toContain("itemArticleDetails");
    expect(stale).toContain("itemImageDetails");
    expect(stale).toContain("itemProductDetails");
    expect(stale).toContain("itemBookDetails");
    expect(stale).toContain("itemVideoDetails");
    expect(stale).toContain("itemTwitterDetails");
    expect(stale).toContain("itemNoteDetails");
  });

  it("never lists a kind's own table as stale", () => {
    expect(staleDetailModelsForKind("image")).not.toContain("itemImageDetails");
    expect(staleDetailModelsForKind("twitter")).not.toContain(
      "itemTwitterDetails",
    );
    expect(staleDetailModelsForKind("video")).not.toContain("itemVideoDetails");
    expect(staleDetailModelsForKind("book")).not.toContain("itemBookDetails");
    expect(staleDetailModelsForKind("note")).not.toContain("itemNoteDetails");
  });
});
