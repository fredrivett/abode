import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyItemKind } from "./classify-item-kind";

const goodreadsBookFixture = readFileSync(
  join(__dirname, "__fixtures__/goodreads-book-snippet.html"),
  "utf-8",
);
const audioTechnicaProductFixture = readFileSync(
  join(__dirname, "__fixtures__/audio-technica-product-snippet.html"),
  "utf-8",
);

/** Helper: classify with sensible defaults, overriding as needed. */
function classify(overrides: {
  url?: string;
  resolvedUrl?: string;
  contentType?: string | null;
  html?: string | null;
  getArticleWordCount?: () => number;
}) {
  const url = overrides.url ?? "https://example.com/thing";
  return classifyItemKind({
    url,
    resolvedUrl: overrides.resolvedUrl ?? url,
    contentType: overrides.contentType ?? null,
    html: overrides.html ?? null,
    getArticleWordCount: overrides.getArticleWordCount,
  });
}

describe("classifyItemKind — URL-only signals (no HTML)", () => {
  it("classifies a tweet URL as twitter", () => {
    const result = classify({
      url: "https://twitter.com/jack/status/20",
    });
    expect(result).toEqual({
      kind: "twitter",
      tweetId: "20",
      url: "https://twitter.com/jack/status/20",
    });
  });

  it("classifies an x.com tweet URL as twitter", () => {
    const result = classify({ url: "https://x.com/user/status/1234567890" });
    expect(result?.kind).toBe("twitter");
  });

  it("classifies a YouTube URL as video", () => {
    const result = classify({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(result).toMatchObject({
      kind: "video",
      platform: "youtube",
      videoId: "dQw4w9WgXcQ",
    });
  });

  it("classifies a Vimeo URL as video", () => {
    const result = classify({ url: "https://vimeo.com/123456789" });
    expect(result).toMatchObject({ kind: "video", platform: "vimeo" });
  });

  it("classifies an image URL by extension as image", () => {
    const result = classify({ url: "https://cdn.example.com/photo.jpg" });
    expect(result).toEqual({
      kind: "image",
      url: "https://cdn.example.com/photo.jpg",
    });
  });

  it("classifies by content-type when the URL has no extension", () => {
    const result = classify({
      url: "https://cdn.example.com/asset",
      contentType: "image/png",
    });
    expect(result?.kind).toBe("image");
  });

  it("returns null when no URL/header signal matches and HTML is absent", () => {
    const result = classify({ url: "https://example.com/some/article" });
    expect(result).toBeNull();
  });

  it("uses the resolved URL for detection (t.co → tweet)", () => {
    const result = classify({
      url: "https://t.co/abc123",
      resolvedUrl: "https://twitter.com/user/status/9999",
    });
    expect(result).toMatchObject({ kind: "twitter", tweetId: "9999" });
  });
});

describe("classifyItemKind — HTML-based signals", () => {
  it("classifies a Goodreads book page as book", () => {
    const result = classifyItemKind({
      url: "https://www.goodreads.com/book/show/54493401",
      resolvedUrl: "https://www.goodreads.com/book/show/54493401",
      contentType: "text/html",
      html: goodreadsBookFixture,
    });
    expect(result?.kind).toBe("book");
    if (result?.kind === "book") {
      expect(result.bookMeta.authors).toEqual(["Andy Weir"]);
      expect(result.bookMeta.isbn).toBe("9780593135204");
      expect(result.bookMeta.pageCount).toBe(496);
    }
  });

  it("classifies a real product page as product", () => {
    const result = classifyItemKind({
      url: "https://www.audio-technica.com/en-gb/at-lp120xusb",
      resolvedUrl: "https://www.audio-technica.com/en-gb/at-lp120xusb",
      contentType: "text/html",
      html: audioTechnicaProductFixture,
    });
    expect(result?.kind).toBe("product");
  });

  it("prefers book over product when a page has both signals", () => {
    // The Goodreads fixture carries product:price:* tags too — book must win.
    const result = classifyItemKind({
      url: "https://www.goodreads.com/book/show/54493401",
      resolvedUrl: "https://www.goodreads.com/book/show/54493401",
      contentType: "text/html",
      html: goodreadsBookFixture,
    });
    expect(result?.kind).toBe("book");
  });

  it("classifies long readable content as article", () => {
    const html = `
      <meta property="og:type" content="article" />
      <meta property="og:title" content="A Long Read" />
    `;
    const result = classify({
      url: "https://blog.example.com/post",
      contentType: "text/html",
      html,
      getArticleWordCount: () => 800,
    });
    expect(result).toMatchObject({ kind: "article" });
  });

  it("classifies thin content as a generic webpage", () => {
    const html = `
      <meta property="og:type" content="website" />
      <title>Homepage</title>
    `;
    const result = classify({
      url: "https://example.com",
      contentType: "text/html",
      html,
      getArticleWordCount: () => 12,
    });
    expect(result).toMatchObject({ kind: "webpage" });
  });

  it("only invokes the article word-count callback when it reaches the article decision", () => {
    let called = 0;
    const countFn = () => {
      called++;
      return 500;
    };
    // A book page should short-circuit before the article/webpage decision.
    classifyItemKind({
      url: "https://www.goodreads.com/book/show/1",
      resolvedUrl: "https://www.goodreads.com/book/show/1",
      contentType: "text/html",
      html: goodreadsBookFixture,
      getArticleWordCount: countFn,
    });
    expect(called).toBe(0);
  });

  it("treats a Twitter profile (no tweet id) as article/webpage once HTML is present", () => {
    const html = "<title>Profile</title>";
    const result = classify({
      url: "https://twitter.com/someuser",
      contentType: "text/html",
      html,
      getArticleWordCount: () => 0,
    });
    expect(result?.kind).toBe("webpage");
  });
});
