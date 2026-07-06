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
const amazonBookFixture = readFileSync(
  join(__dirname, "__fixtures__/amazon-book-snippet.html"),
  "utf-8",
);
const amazonKindleBookFixture = readFileSync(
  join(__dirname, "__fixtures__/amazon-kindle-book-snippet.html"),
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

  it("classifies a Twitter Article URL as twitterArticle", () => {
    const result = classify({ url: "https://x.com/i/article/1234567890" });
    expect(result).toEqual({
      kind: "twitterArticle",
      articleId: "1234567890",
      url: "https://x.com/i/article/1234567890",
    });
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

  it("classifies an Amazon short link as book once redirects resolve", () => {
    // https://amzn.eu/d/04gXpZji → 301 → the amazon.co.uk product page. The
    // classify-url task captures the post-redirect response.url as
    // resolvedUrl — required here, since short-link paths carry no ASIN
    const result = classifyItemKind({
      url: "https://amzn.eu/d/04gXpZji",
      resolvedUrl:
        "https://www.amazon.co.uk/dp/1847940323?ref=cm_sw_r_ffobk_cso_cp_mwn_dp",
      contentType: "text/html",
      html: amazonBookFixture,
    });
    expect(result?.kind).toBe("book");
    if (result?.kind === "book") {
      expect(result.bookMeta.title).toBe(
        "Switch: How to change things when change is hard",
      );
      expect(result.bookMeta.authors).toEqual(["Dan Heath", "Chip Heath"]);
      expect(result.bookMeta.isbn).toBe("9781847940322");
    }
  });

  it("classifies an Amazon slug URL as book", () => {
    const result = classifyItemKind({
      url: "https://www.amazon.co.uk/Switch-change-things-when-hard/dp/1847940323",
      resolvedUrl:
        "https://www.amazon.co.uk/Switch-change-things-when-hard/dp/1847940323",
      contentType: "text/html",
      html: amazonBookFixture,
    });
    expect(result?.kind).toBe("book");
  });

  it("classifies an Amazon Kindle edition as book", () => {
    const result = classifyItemKind({
      url: "https://www.amazon.co.uk/dp/B005TKD512",
      resolvedUrl: "https://www.amazon.co.uk/dp/B005TKD512",
      contentType: "text/html",
      html: amazonKindleBookFixture,
    });
    expect(result?.kind).toBe("book");
    if (result?.kind === "book") {
      expect(result.bookMeta.authors).toEqual(["Chip Heath", "Dan Heath"]);
    }
  });

  it("does not classify a non-book Amazon product as book", () => {
    const html =
      "<title>Sony WH-1000XM5 Noise Cancelling Headphones: Amazon.co.uk: Electronics</title>";
    const result = classifyItemKind({
      url: "https://www.amazon.co.uk/dp/B09XS7JWHH",
      resolvedUrl: "https://www.amazon.co.uk/dp/B09XS7JWHH",
      contentType: "text/html",
      html,
    });
    expect(result?.kind).not.toBe("book");
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

  it("treats exactly MIN_ARTICLE_WORDS as an article, one below as a webpage", () => {
    const html = `<meta property="og:type" content="article" />`;
    const atThreshold = classify({
      url: "https://blog.example.com/post",
      contentType: "text/html",
      html,
      getArticleWordCount: () => 100,
    });
    expect(atThreshold?.kind).toBe("article");

    const belowThreshold = classify({
      url: "https://blog.example.com/post",
      contentType: "text/html",
      html,
      getArticleWordCount: () => 99,
    });
    expect(belowThreshold?.kind).toBe("webpage");
  });

  it("defaults to webpage when no word-count callback is provided", () => {
    const result = classifyItemKind({
      url: "https://example.com",
      resolvedUrl: "https://example.com",
      contentType: "text/html",
      html: "<title>Bare page</title>",
    });
    expect(result?.kind).toBe("webpage");
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
