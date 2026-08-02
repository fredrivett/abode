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
  getOgRoom: vi.fn(),
}));

import { getOgRoom } from "@/lib/og/data";
import Image, { contentType } from "./opengraph-image";

const mockGetOgRoom = vi.mocked(getOgRoom);

describe("room opengraph-image", () => {
  beforeEach(() => vi.clearAllMocks());

  it("declares a png content type", () => {
    expect(contentType).toBe("image/png");
  });

  it("renders a png for a public room", async () => {
    mockGetOgRoom.mockResolvedValue({
      name: "Living Room",
      emoji: "🛋️",
      itemCount: 8,
      ownerUsername: "fred",
    });

    const res = await Image({
      params: Promise.resolve({ username: "@fred", slug: "living-room" }),
    });
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("falls back when the room is private/not found", async () => {
    mockGetOgRoom.mockResolvedValue(null);

    const res = await Image({
      params: Promise.resolve({ username: "@fred", slug: "secret" }),
    });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(mockGetOgRoom).toHaveBeenCalled();
  });
});
