import { describe, expect, it } from "vitest";
import { deriveRoomThumbnail, deriveRoomThumbnails } from "./room-thumbnails";

describe("deriveRoomThumbnail", () => {
  it("uses fileKey for image items and carries the blur placeholder", () => {
    const thumb = deriveRoomThumbnail({
      fileKey: "user/photo.jpg",
      coverFileKey: null,
      imageDetails: { blurDataUrl: "data:blur" },
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
    });
    expect(thumb?.url).toContain("user%2Fcover.jpg");
    expect(thumb?.blurDataUrl).toBeNull();
  });

  it("returns null when the item has no cover image", () => {
    expect(
      deriveRoomThumbnail({
        fileKey: null,
        coverFileKey: null,
        imageDetails: null,
      }),
    ).toBeNull();
  });
});

describe("deriveRoomThumbnails", () => {
  it("drops items without a cover image", () => {
    const thumbs = deriveRoomThumbnails([
      { fileKey: "a.jpg", coverFileKey: null, imageDetails: null },
      { fileKey: null, coverFileKey: null, imageDetails: null },
      { fileKey: null, coverFileKey: "b.jpg", imageDetails: null },
    ]);
    expect(thumbs).toHaveLength(2);
  });
});
