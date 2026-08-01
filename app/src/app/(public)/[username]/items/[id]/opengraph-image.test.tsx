import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/og", () => ({
  ImageResponse: vi.fn(function ImageResponseStub() {
    return new Response("png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));

vi.mock("@/lib/og/data", () => ({
  parseOgUsername: (raw: string) => (raw.startsWith("@") ? raw.slice(1) : null),
  getOgItem: vi.fn(),
}));

import { getOgItem } from "@/lib/og/data";
import Image, { contentType } from "./opengraph-image";

const mockGetOgItem = vi.mocked(getOgItem);

describe("item opengraph-image", () => {
  beforeEach(() => vi.clearAllMocks());

  it("declares a png content type", () => {
    expect(contentType).toBe("image/png");
  });

  it("renders a png hero for an item with a cover", async () => {
    mockGetOgItem.mockResolvedValue({
      title: "A nice chair",
      kind: "product",
      coverFileKey: "user/cover.jpg",
      fileKey: null,
      ownerUsername: "fred",
    });

    const res = await Image({
      params: Promise.resolve({ username: "@fred", id: "item-1" }),
    });
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("renders a png text card for an item without a cover", async () => {
    mockGetOgItem.mockResolvedValue({
      title: "Just a note",
      kind: "note",
      coverFileKey: null,
      fileKey: null,
      ownerUsername: "fred",
    });

    const res = await Image({
      params: Promise.resolve({ username: "@fred", id: "item-2" }),
    });
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("falls back when the item is private/not found", async () => {
    mockGetOgItem.mockResolvedValue(null);

    const res = await Image({
      params: Promise.resolve({ username: "@fred", id: "hidden" }),
    });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(mockGetOgItem).toHaveBeenCalled();
  });
});
