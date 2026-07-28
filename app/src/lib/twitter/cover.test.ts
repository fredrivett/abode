import { describe, expect, it } from "vitest";
import type { TwitterMedia } from "@/lib/types/item";
import { resolveTweetCoverFileKey } from "./cover";

const photo = (fileKey?: string): TwitterMedia => ({
  type: "photo",
  url: "https://pbs.twimg.com/x.jpg",
  ...(fileKey && { fileKey }),
});

describe("resolveTweetCoverFileKey", () => {
  it("returns the selected index's re-hosted key", () => {
    const media = [photo("u/a.jpg"), photo("u/b.jpg")];
    expect(resolveTweetCoverFileKey(media, 1)).toBe("u/b.jpg");
  });

  it("defaults a null index to the first media", () => {
    expect(resolveTweetCoverFileKey([photo("u/a.jpg")], null)).toBe("u/a.jpg");
  });

  it("returns null when the selected media isn't re-hosted", () => {
    expect(resolveTweetCoverFileKey([photo()], 0)).toBeNull();
  });

  it("returns null for an out-of-range index", () => {
    expect(resolveTweetCoverFileKey([photo("u/a.jpg")], 5)).toBeNull();
  });

  it("returns null when there's no media", () => {
    expect(resolveTweetCoverFileKey(null, 0)).toBeNull();
    expect(resolveTweetCoverFileKey([], 0)).toBeNull();
  });
});
