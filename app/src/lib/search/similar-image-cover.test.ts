import { describe, expect, it } from "vitest";
import { resolveSimilarImageCover } from "./similar-image-cover";

const BLUR_A = "data:image/webp;base64,AAAA";
const BLUR_B = "data:image/webp;base64,BBBB";

describe("resolveSimilarImageCover", () => {
  it("uses fileKey and imageDetails LQIP for a single-image item", () => {
    expect(
      resolveSimilarImageCover({
        fileKey: "user/photo.jpg",
        coverFileKey: null,
        imageDetailsBlurDataUrl: BLUR_A,
        mediaAnalyses: [],
      }),
    ).toEqual({ fileKey: "user/photo.jpg", blurDataUrl: BLUR_A });
  });

  it("follows coverFileKey (not fileKey) for a multi-image item", () => {
    // A tweet whose selected cover differs from its primary fileKey: both the
    // thumbnail and the blur must track the cover the vector was computed on.
    expect(
      resolveSimilarImageCover({
        fileKey: "user/tweet-img-1.jpg",
        coverFileKey: "user/tweet-img-3.jpg",
        imageDetailsBlurDataUrl: null,
        mediaAnalyses: [
          { fileKey: "user/tweet-img-1.jpg", blurDataUrl: BLUR_A },
          { fileKey: "user/tweet-img-3.jpg", blurDataUrl: BLUR_B },
        ],
      }),
    ).toEqual({ fileKey: "user/tweet-img-3.jpg", blurDataUrl: BLUR_B });
  });

  it("falls back to fileKey when there is no cover override", () => {
    expect(
      resolveSimilarImageCover({
        fileKey: "user/photo.jpg",
        coverFileKey: null,
        imageDetailsBlurDataUrl: null,
        mediaAnalyses: [{ fileKey: "user/photo.jpg", blurDataUrl: BLUR_A }],
      }),
    ).toEqual({ fileKey: "user/photo.jpg", blurDataUrl: BLUR_A });
  });

  it("returns a null blur when nothing matches the cover", () => {
    expect(
      resolveSimilarImageCover({
        fileKey: "user/tweet-img-1.jpg",
        coverFileKey: "user/tweet-img-3.jpg",
        imageDetailsBlurDataUrl: null,
        mediaAnalyses: [
          { fileKey: "user/tweet-img-1.jpg", blurDataUrl: BLUR_A },
        ],
      }),
    ).toEqual({ fileKey: "user/tweet-img-3.jpg", blurDataUrl: null });
  });

  it("prefers the cover-specific media LQIP over imageDetails", () => {
    // After a cover swap, imageDetails can hold the prior cover's (stale) blur
    // while mediaAnalyses has the fresh per-file one — the media row must win.
    expect(
      resolveSimilarImageCover({
        fileKey: "user/tweet-img-1.jpg",
        coverFileKey: "user/tweet-img-3.jpg",
        imageDetailsBlurDataUrl: BLUR_A,
        mediaAnalyses: [
          { fileKey: "user/tweet-img-3.jpg", blurDataUrl: BLUR_B },
        ],
      }),
    ).toEqual({ fileKey: "user/tweet-img-3.jpg", blurDataUrl: BLUR_B });
  });

  it("does not fall back to imageDetails for a multi-image item with a pending cover", () => {
    // Freshly-selected cover img-3 has no media row yet; imageDetails still
    // holds the prior cover's blur. Show no LQIP rather than the stale one.
    expect(
      resolveSimilarImageCover({
        fileKey: "user/tweet-img-1.jpg",
        coverFileKey: "user/tweet-img-3.jpg",
        imageDetailsBlurDataUrl: BLUR_A,
        mediaAnalyses: [
          { fileKey: "user/tweet-img-1.jpg", blurDataUrl: BLUR_B },
        ],
      }),
    ).toEqual({ fileKey: "user/tweet-img-3.jpg", blurDataUrl: null });
  });
});
