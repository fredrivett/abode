import { describe, expect, it } from "vitest";
import { deriveRoomThumbnail, deriveRoomThumbnails } from "./room-thumbnails";

describe("deriveRoomThumbnail", () => {
  it("uses fileKey for single-image items and carries the blur placeholder", () => {
    const thumb = deriveRoomThumbnail({
      fileKey: "user/photo.jpg",
      coverFileKey: null,
      imageDetails: { blurDataUrl: "data:blur" },
      mediaAnalyses: [],
    });
    expect(thumb).toEqual({
      url: expect.stringContaining("user%2Fphoto.jpg"),
      blurDataUrl: "data:blur",
    });
  });

  it("prefers coverFileKey when both are present (non-image kinds)", () => {
    const thumb = deriveRoomThumbnail({
      fileKey: "user/raw.jpg",
      coverFileKey: "user/cover.jpg",
      imageDetails: null,
      mediaAnalyses: [],
    });
    expect(thumb?.url).toContain("user%2Fcover.jpg");
  });

  it("follows the swapped cover's blur, not the stale imageDetails mirror", () => {
    // Multi-image item whose cover just changed to media-b; imageDetails still
    // mirrors media-a's blur until re-analysis lands.
    const thumb = deriveRoomThumbnail({
      fileKey: "media-a.jpg",
      coverFileKey: "media-b.jpg",
      imageDetails: { blurDataUrl: "stale-a-blur" },
      mediaAnalyses: [
        { fileKey: "media-a.jpg", blurDataUrl: "stale-a-blur" },
        { fileKey: "media-b.jpg", blurDataUrl: "fresh-b-blur" },
      ],
    });
    expect(thumb?.url).toContain("media-b.jpg");
    expect(thumb?.blurDataUrl).toBe("fresh-b-blur");
  });

  it("omits the blur when the new cover's analysis is still pending", () => {
    // Cover swapped to media-b but its analysis row isn't mirrored yet — better
    // no blur than the previous cover's.
    const thumb = deriveRoomThumbnail({
      fileKey: "media-a.jpg",
      coverFileKey: "media-b.jpg",
      imageDetails: { blurDataUrl: "stale-a-blur" },
      mediaAnalyses: [{ fileKey: "media-a.jpg", blurDataUrl: "stale-a-blur" }],
    });
    expect(thumb?.url).toContain("media-b.jpg");
    expect(thumb?.blurDataUrl).toBeNull();
  });

  it("returns null when the item has no cover image", () => {
    expect(
      deriveRoomThumbnail({
        fileKey: null,
        coverFileKey: null,
        imageDetails: null,
        mediaAnalyses: [],
      }),
    ).toBeNull();
  });
});

describe("deriveRoomThumbnails", () => {
  it("drops items without a cover image", () => {
    const thumbs = deriveRoomThumbnails([
      {
        fileKey: "a.jpg",
        coverFileKey: null,
        imageDetails: null,
        mediaAnalyses: [],
      },
      {
        fileKey: null,
        coverFileKey: null,
        imageDetails: null,
        mediaAnalyses: [],
      },
      {
        fileKey: null,
        coverFileKey: "b.jpg",
        imageDetails: null,
        mediaAnalyses: [],
      },
    ]);
    expect(thumbs).toHaveLength(2);
  });
});
