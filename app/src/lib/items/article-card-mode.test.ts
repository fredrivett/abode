import { describe, expect, it } from "vitest";

import { articleCardMode } from "./article-card-mode";

describe("articleCardMode", () => {
  const base = {
    isArticleOrWebpage: true,
    hasCover: false,
    previewReady: false,
    coverHidden: false,
  };

  it("returns null for non-article kinds", () => {
    expect(articleCardMode({ ...base, isArticleOrWebpage: false })).toBeNull();
  });

  it("renders the text card when there is no cover", () => {
    expect(articleCardMode(base)).toBe("text");
  });

  it("renders the cover hero once a visible cover has loaded", () => {
    expect(
      articleCardMode({ ...base, hasCover: true, previewReady: true }),
    ).toBe("cover");
  });

  it("falls through (null) while a visible cover's preview is still loading", () => {
    expect(
      articleCardMode({ ...base, hasCover: true, previewReady: false }),
    ).toBeNull();
  });

  it("renders the text card when a loaded cover is hidden", () => {
    expect(
      articleCardMode({
        ...base,
        hasCover: true,
        previewReady: true,
        coverHidden: true,
      }),
    ).toBe("text");
  });

  it("renders the text card immediately for a hidden cover, without waiting on the preview", () => {
    expect(
      articleCardMode({
        ...base,
        hasCover: true,
        previewReady: false,
        coverHidden: true,
      }),
    ).toBe("text");
  });
});
