import { ImageResponse } from "next/og";
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
  getOgHighlight: vi.fn(),
}));

import { HighlightShareCard } from "@/components/article/highlight-share-card";
import { getOgHighlight } from "@/lib/og/data";
import Image, { contentType } from "./opengraph-image";

const mockGetOgHighlight = vi.mocked(getOgHighlight);
const mockImageResponse = vi.mocked(ImageResponse);

const params = (username: string) =>
  Promise.resolve({ username, id: "item-1", highlightId: "hl-1" });

// The element handed to ImageResponse
function renderedElement() {
  const element = mockImageResponse.mock.calls[0]?.[0];
  if (!element || typeof element !== "object" || !("type" in element)) {
    throw new Error("ImageResponse was not called with an element");
  }
  return element;
}

describe("highlight opengraph-image", () => {
  beforeEach(() => vi.clearAllMocks());

  it("declares a png content type", () => {
    expect(contentType).toBe("image/png");
  });

  it("renders the highlight share card for a viewable highlight", async () => {
    mockGetOgHighlight.mockResolvedValue({
      text: "Less, but better.",
      itemTitle: "Good design",
      domain: "example.com",
      ownerUsername: "fred",
    });

    const res = await Image({ params: params("@fred") });

    expect(res.headers.get("content-type")).toBe("image/png");
    expect(mockGetOgHighlight).toHaveBeenCalledWith({
      username: "fred",
      itemId: "item-1",
      highlightId: "hl-1",
    });
    const element = renderedElement();
    expect(element.type).toBe(HighlightShareCard);
    expect(element.props).toMatchObject({
      text: "Less, but better.",
      title: "Good design",
      domain: "example.com",
      ownerUsername: "fred",
    });
  });

  it("falls back to the branded card when the highlight isn't viewable", async () => {
    mockGetOgHighlight.mockResolvedValue(null);

    await Image({ params: params("@fred") });

    expect(renderedElement().type).not.toBe(HighlightShareCard);
  });

  it("falls back without querying when the username lacks an @", async () => {
    await Image({ params: params("fred") });

    expect(mockGetOgHighlight).not.toHaveBeenCalled();
    expect(renderedElement().type).not.toBe(HighlightShareCard);
  });
});
