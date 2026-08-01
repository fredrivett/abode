import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub next/og so tests don't invoke the heavy satori/resvg rendering — we only
// care that the route builds a PNG response for both paths.
vi.mock("next/og", () => ({
  ImageResponse: vi.fn(function ImageResponseStub() {
    return new Response("png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));

vi.mock("@/lib/og/data", () => ({
  parseOgUsername: (raw: string) => (raw.startsWith("@") ? raw.slice(1) : null),
  getOgProfile: vi.fn(),
}));

import { getOgProfile } from "@/lib/og/data";
import Image, { contentType } from "./opengraph-image";

const mockGetOgProfile = vi.mocked(getOgProfile);

describe("profile opengraph-image", () => {
  beforeEach(() => vi.clearAllMocks());

  it("declares a png content type", () => {
    expect(contentType).toBe("image/png");
  });

  it("renders a png for a real public profile", async () => {
    mockGetOgProfile.mockResolvedValue({
      username: "fred",
      firstName: "Fred",
      lastName: "Rivett",
      avatarUrl: "https://example.com/a.png",
      itemCount: 12,
      roomCount: 3,
    });

    const res = await Image({ params: Promise.resolve({ username: "@fred" }) });
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("falls back to a branded png when the profile is missing", async () => {
    mockGetOgProfile.mockResolvedValue(null);

    const res = await Image({
      params: Promise.resolve({ username: "@ghost" }),
    });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(mockGetOgProfile).toHaveBeenCalled();
  });

  it("falls back for a malformed (no @) username without fetching", async () => {
    const res = await Image({ params: Promise.resolve({ username: "fred" }) });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(mockGetOgProfile).not.toHaveBeenCalled();
  });
});
