import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub next/og so tests don't invoke the heavy satori/resvg rendering — we
// capture the element instead and assert on its markup
vi.mock("next/og", () => ({
  ImageResponse: vi.fn(function ImageResponseStub() {
    return new Response("png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));

import { ImageResponse } from "next/og";
import Image, { contentType } from "./opengraph-image";

const render = (competitor: string) =>
  Image({ params: Promise.resolve({ competitor }) });

function lastMarkup(): string {
  const [element] = vi.mocked(ImageResponse).mock.lastCall as [ReactElement];
  return renderToStaticMarkup(element);
}

describe("comparison opengraph-image", () => {
  beforeEach(() => vi.mocked(ImageResponse).mockClear());

  it("declares a png content type", () => {
    expect(contentType).toBe("image/png");
  });

  it("names the competitor in the card", async () => {
    const res = await render("pinterest");
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(lastMarkup()).toContain("abode vs Pinterest");
  });

  it("falls back to the branded card for an unknown competitor", async () => {
    const res = await render("nope");
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(lastMarkup()).not.toContain("abode vs");
  });
});
