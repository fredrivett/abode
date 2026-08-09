import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ArticleContentSignals,
  classifyItemKind,
} from "./classify-item-kind";
import type { ForcibleKind } from "./item-kind-reassignment";

/** Readable-content signals shaped like a long-form prose article. */
const PROSE_SIGNALS: ArticleContentSignals = {
  wordCount: 800,
  linkDensity: 0.02,
  longestParagraphWords: 120,
};

/** Readable-content signals shaped like a link hub / thin page (not an article). */
const NON_PROSE_SIGNALS: ArticleContentSignals = {
  wordCount: 40,
  linkDensity: 0.4,
  longestParagraphWords: 12,
};

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
  getArticleSignals?: () => ArticleContentSignals;
  forcedKind?: ForcibleKind;
}) {
  const url = overrides.url ?? "https://example.com/thing";
  return classifyItemKind({
    url,
    resolvedUrl: overrides.resolvedUrl ?? url,
    contentType: overrides.contentType ?? null,
    html: overrides.html ?? null,
    getArticleSignals: overrides.getArticleSignals,
    forcedKind: overrides.forcedKind,
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

  it("classifies an Instagram post URL as instagram", () => {
    expect(
      classify({ url: "https://www.instagram.com/p/DbMJgxFiNTq/" }),
    ).toEqual({
      kind: "instagram",
      postId: "DbMJgxFiNTq",
      mediaType: "post",
      url: "https://www.instagram.com/p/DbMJgxFiNTq/",
    });
  });

  it("classifies an Instagram reel URL as instagram", () => {
    expect(
      classify({ url: "https://www.instagram.com/reel/AbC123/" }),
    ).toMatchObject({ kind: "instagram", mediaType: "reel", postId: "AbC123" });
  });

  it("does not classify an Instagram profile URL as instagram (falls through)", () => {
    // No post shortcode → returns null (caller fetches the body and retries as
    // article/webpage), so it must not be classified as instagram.
    const result = classify({ url: "https://www.instagram.com/oliverhamrin/" });
    expect(result?.kind).not.toBe("instagram");
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

  it("classifies a page that declares itself an article (og:type) as article", () => {
    const html = `<meta property="og:type" content="article" />`;
    // No prose signals at all — the explicit declaration alone wins.
    const result = classify({
      url: "https://blog.example.com/post",
      contentType: "text/html",
      html,
      getArticleSignals: () => NON_PROSE_SIGNALS,
    });
    expect(result?.kind).toBe("article");
  });

  it("classifies a page with an article JSON-LD type as article", () => {
    const html = `<script type="application/ld+json">{"@type":"BlogPosting","headline":"x"}</script>`;
    const result = classify({
      url: "https://blog.example.com/post",
      contentType: "text/html",
      html,
      getArticleSignals: () => NON_PROSE_SIGNALS,
    });
    expect(result?.kind).toBe("article");
  });

  it("classifies a page with article:published_time as article", () => {
    const html = `<meta property="article:published_time" content="2025-01-01T00:00:00Z" />`;
    const result = classify({
      url: "https://blog.example.com/post",
      contentType: "text/html",
      html,
      getArticleSignals: () => NON_PROSE_SIGNALS,
    });
    expect(result?.kind).toBe("article");
  });

  it("classifies metadata-less prose (low link density, long paragraph) as article", () => {
    const result = classify({
      url: "https://essays.example.com/thoughts",
      contentType: "text/html",
      html: "<title>An essay</title>",
      getArticleSignals: () => PROSE_SIGNALS,
    });
    expect(result?.kind).toBe("article");
  });

  it("classifies a link-dense homepage (no article metadata) as webpage", () => {
    // og:type=website plus link-heavy content — a homepage, not an article.
    const result = classify({
      url: "https://example.com",
      contentType: "text/html",
      html: `<meta property="og:type" content="website" /><title>Homepage</title>`,
      getArticleSignals: () => ({
        wordCount: 900,
        linkDensity: 0.5,
        longestParagraphWords: 30,
      }),
    });
    expect(result?.kind).toBe("webpage");
  });

  it("classifies a low-link page without a sustained paragraph as webpage", () => {
    // Prose-ish but fragmented (e.g. a thin about page): no long paragraph.
    const result = classify({
      url: "https://example.com/about",
      contentType: "text/html",
      html: "<title>About</title>",
      getArticleSignals: () => ({
        wordCount: 320,
        linkDensity: 0.02,
        longestParagraphWords: 52,
      }),
    });
    expect(result?.kind).toBe("webpage");
  });

  it("defaults to webpage when no signals callback is provided", () => {
    const result = classifyItemKind({
      url: "https://example.com",
      resolvedUrl: "https://example.com",
      contentType: "text/html",
      html: "<title>Bare page</title>",
    });
    expect(result?.kind).toBe("webpage");
  });

  it("only invokes the article signals callback when it reaches the article decision", () => {
    let called = 0;
    const signalsFn = () => {
      called++;
      return PROSE_SIGNALS;
    };
    // A book page should short-circuit before the article/webpage decision.
    classifyItemKind({
      url: "https://www.goodreads.com/book/show/1",
      resolvedUrl: "https://www.goodreads.com/book/show/1",
      contentType: "text/html",
      html: goodreadsBookFixture,
      getArticleSignals: signalsFn,
    });
    expect(called).toBe(0);
  });

  it("treats a Twitter profile (no tweet id) as article/webpage once HTML is present", () => {
    const html = "<title>Profile</title>";
    const result = classify({
      url: "https://twitter.com/someuser",
      contentType: "text/html",
      html,
      getArticleSignals: () => NON_PROSE_SIGNALS,
    });
    expect(result?.kind).toBe("webpage");
  });
});

describe("classifyItemKind — forcedKind (manual reassignment)", () => {
  const articleHtml =
    "<title>A Great Read</title><meta name='description' content='desc'>";

  it("returns null while HTML is absent (caller must fetch the body)", () => {
    expect(
      classify({ url: "https://example.com/x", forcedKind: "article" }),
    ).toBeNull();
  });

  it("forces a webpage-shaped page as article regardless of signals", () => {
    const result = classify({
      html: articleHtml,
      forcedKind: "article",
      getArticleSignals: () => NON_PROSE_SIGNALS, // would heuristically be webpage
    });
    expect(result?.kind).toBe("article");
  });

  it("forces a prose-shaped page as webpage regardless of signals", () => {
    const result = classify({
      html: articleHtml,
      forcedKind: "webpage",
      getArticleSignals: () => PROSE_SIGNALS, // would heuristically be article
    });
    expect(result?.kind).toBe("webpage");
  });

  it("uses real book metadata when the page has it", () => {
    const result = classify({
      url: "https://www.goodreads.com/book/show/1",
      resolvedUrl: "https://www.goodreads.com/book/show/1",
      contentType: "text/html",
      html: goodreadsBookFixture,
      forcedKind: "book",
    });
    expect(result?.kind).toBe("book");
    if (result?.kind === "book") {
      expect(result.bookMeta.title).toBeTruthy();
    }
  });

  it("forces product on a plain page with sparse best-effort metadata", () => {
    const result = classify({
      url: "https://example.com/thing",
      html: articleHtml,
      forcedKind: "product",
    });
    expect(result?.kind).toBe("product");
    if (result?.kind === "product") {
      // No structured product signals on the page → nullable fields stay empty
      expect(result.productMeta.price).toBeNull();
      expect(result.productMeta.brand).toBeNull();
      expect(result.productMeta.domain).toBe("example.com");
    }
  });

  it("forces book on a plain page with sparse best-effort metadata", () => {
    const result = classify({
      url: "https://example.com/thing",
      html: articleHtml,
      forcedKind: "book",
    });
    expect(result?.kind).toBe("book");
    if (result?.kind === "book") {
      expect(result.bookMeta.authors).toEqual([]);
      expect(result.bookMeta.isbn).toBeNull();
    }
  });

  it("ignores twitter/video URL signals when a kind is forced", () => {
    const result = classify({
      url: "https://x.com/user/status/123",
      resolvedUrl: "https://x.com/user/status/123",
      contentType: "text/html",
      html: articleHtml,
      forcedKind: "article",
    });
    expect(result?.kind).toBe("article");
  });
});
