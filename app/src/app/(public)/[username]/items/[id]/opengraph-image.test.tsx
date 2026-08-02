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
  getOgItem: vi.fn(),
}));

import { getOgItem } from "@/lib/og/data";
import Image, { contentType } from "./opengraph-image";

const mockGetOgItem = vi.mocked(getOgItem);
const mockImageResponse = vi.mocked(ImageResponse);

// The ImageResponse stub always returns image/png, so content-type alone can't
// distinguish the hero/text/fallback branches. Instead, walk the JSX element
// handed to ImageResponse and collect the rendered text + image srcs so each
// branch can be asserted on its actual observable output.
type Collected = { text: string[]; src: string[] };
function collect(
  node: unknown,
  acc: Collected = { text: [], src: [] },
): Collected {
  if (node == null || typeof node === "boolean") return acc;
  if (typeof node === "string" || typeof node === "number") {
    acc.text.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    for (const child of node) collect(child, acc);
    return acc;
  }
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: Record<string, unknown> }).props ?? {};
    if (typeof props.src === "string") acc.src.push(props.src);
    collect(props.children, acc);
  }
  return acc;
}

function renderedCard(): Collected {
  return collect(mockImageResponse.mock.calls[0]?.[0]);
}

describe("item opengraph-image", () => {
  beforeEach(() => vi.clearAllMocks());

  it("declares a png content type", () => {
    expect(contentType).toBe("image/png");
  });

  it("renders a cover hero for an item with a cover", async () => {
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

    // Hero branch: embeds the cover image and the item title.
    const { text, src } = renderedCard();
    expect(src.join(" ")).toContain("cover.jpg");
    expect(text).toContain("A nice chair");
  });

  it("renders a text card (no cover image) for an item without a cover", async () => {
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

    // Text branch: the title renders but no cover <img> is embedded.
    const { text, src } = renderedCard();
    expect(src).toHaveLength(0);
    expect(text).toContain("Just a note");
  });

  it("renders the neutral fallback (no cover, no leaked title) when private/not found", async () => {
    mockGetOgItem.mockResolvedValue(null);

    const res = await Image({
      params: Promise.resolve({ username: "@fred", id: "hidden" }),
    });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(mockGetOgItem).toHaveBeenCalledWith("fred", "hidden");

    // Fallback branch: the neutral tagline, never a cover or leaked title.
    const { text, src } = renderedCard();
    expect(src).toHaveLength(0);
    expect(text.join(" ")).toContain("the home for your info");
  });
});
