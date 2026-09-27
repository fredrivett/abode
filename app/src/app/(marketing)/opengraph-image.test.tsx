import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
import Image, { alt, contentType } from "./opengraph-image";

describe("homepage opengraph-image", () => {
  it("declares a png content type and descriptive alt text", () => {
    expect(contentType).toBe("image/png");
    expect(alt).toBe("abode — your home should be yours");
  });

  it("renders the hero headline and tagline", async () => {
    const res = await Image();
    expect(res.headers.get("content-type")).toBe("image/png");

    const [element] = vi.mocked(ImageResponse).mock.calls[0] as [ReactElement];
    const markup = renderToStaticMarkup(element);
    expect(markup).toContain("your home should be yours.");
    expect(markup).toContain("save everything. sort nothing. own it all.");
  });
});
