import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractAllProductImageCandidates,
  extractAmazonCoverImage,
  extractArticleMetadata,
  extractAuthor,
  extractBookMetadata,
  extractDescription,
  extractDomain,
  extractJsonLdProduct,
  extractMetaContent,
  extractOgImage,
  extractOgType,
  extractProductImageUrls,
  extractProductMetadata,
  extractTitle,
  extractTweetId,
  extractTwitterArticleId,
  inferCurrencyFromPriceContext,
  isKnownBookUrl,
  isKnownProductUrl,
  isValidIsbn10,
  parsePublishedDate,
  preserveSocialEmbeds,
} from "./html-metadata";

// Load test fixtures
const aaronFrancisFixture = readFileSync(
  join(__dirname, "__fixtures__/aaron-francis-tweet-embed.html"),
  "utf-8",
);

const audioTechnicaFixture = readFileSync(
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

describe("extractMetaContent", () => {
  it("extracts Open Graph meta tags (property before content)", () => {
    const html = '<meta property="og:title" content="Test Title">';
    expect(extractMetaContent(html, "og:title")).toBe("Test Title");
  });

  it("extracts Open Graph meta tags (content before property)", () => {
    const html = '<meta content="Test Title" property="og:title">';
    expect(extractMetaContent(html, "og:title")).toBe("Test Title");
  });

  it("extracts standard meta tags (name before content)", () => {
    const html = '<meta name="description" content="Test Description">';
    expect(extractMetaContent(html, "description")).toBe("Test Description");
  });

  it("extracts standard meta tags (content before name)", () => {
    const html = '<meta content="Test Description" name="description">';
    expect(extractMetaContent(html, "description")).toBe("Test Description");
  });

  it("handles single quotes", () => {
    const html = "<meta property='og:title' content='Test Title'>";
    expect(extractMetaContent(html, "og:title")).toBe("Test Title");
  });

  it("is case insensitive for tag names", () => {
    const html = '<META PROPERTY="og:title" CONTENT="Test Title">';
    expect(extractMetaContent(html, "og:title")).toBe("Test Title");
  });

  it("returns null when meta tag not found", () => {
    const html = '<meta property="og:description" content="Test">';
    expect(extractMetaContent(html, "og:title")).toBe(null);
  });

  it("decodes HTML entities", () => {
    const html =
      '<meta property="og:title" content="Test &amp; Title &lt;3&gt;">';
    expect(extractMetaContent(html, "og:title")).toBe("Test & Title <3>");
  });

  it("handles colons in property names", () => {
    const html =
      '<meta property="article:published_time" content="2024-01-15">';
    expect(extractMetaContent(html, "article:published_time")).toBe(
      "2024-01-15",
    );
  });
});

describe("extractTitle", () => {
  it("prefers og:title over title tag", () => {
    const html = `
      <meta property="og:title" content="OG Title">
      <title>Page Title</title>
    `;
    expect(extractTitle(html)).toBe("OG Title");
  });

  it("prefers twitter:title when og:title not available", () => {
    const html = `
      <meta name="twitter:title" content="Twitter Title">
      <title>Page Title</title>
    `;
    expect(extractTitle(html)).toBe("Twitter Title");
  });

  it("falls back to title tag", () => {
    const html = "<title>Page Title</title>";
    expect(extractTitle(html)).toBe("Page Title");
  });

  it("trims whitespace from title tag", () => {
    const html = "<title>  Page Title  </title>";
    expect(extractTitle(html)).toBe("Page Title");
  });

  it("returns null when no title found", () => {
    const html = "<html><body>No title here</body></html>";
    expect(extractTitle(html)).toBe(null);
  });

  it("decodes HTML entities in title tag", () => {
    const html = "<title>Test &amp; Title</title>";
    expect(extractTitle(html)).toBe("Test & Title");
  });
});

describe("extractDescription", () => {
  it("prefers og:description", () => {
    const html = `
      <meta property="og:description" content="OG Description">
      <meta name="description" content="Meta Description">
    `;
    expect(extractDescription(html)).toBe("OG Description");
  });

  it("falls back to meta description", () => {
    const html = '<meta name="description" content="Meta Description">';
    expect(extractDescription(html)).toBe("Meta Description");
  });

  it("falls back to twitter:description", () => {
    const html =
      '<meta name="twitter:description" content="Twitter Description">';
    expect(extractDescription(html)).toBe("Twitter Description");
  });

  it("returns null when no description found", () => {
    const html = "<html><body>No description</body></html>";
    expect(extractDescription(html)).toBe(null);
  });
});

describe("extractAuthor", () => {
  it("extracts author meta tag", () => {
    const html = '<meta name="author" content="John Doe">';
    expect(extractAuthor(html)).toBe("John Doe");
  });

  it("extracts article:author", () => {
    const html = '<meta property="article:author" content="Jane Smith">';
    expect(extractAuthor(html)).toBe("Jane Smith");
  });

  it("prefers author over article:author", () => {
    const html = `
      <meta name="author" content="John Doe">
      <meta property="article:author" content="Jane Smith">
    `;
    expect(extractAuthor(html)).toBe("John Doe");
  });

  it("returns null when no author found", () => {
    const html = "<html><body>No author</body></html>";
    expect(extractAuthor(html)).toBe(null);
  });
});

describe("extractOgImage", () => {
  it("extracts og:image", () => {
    const html =
      '<meta property="og:image" content="https://example.com/image.jpg">';
    expect(extractOgImage(html)).toBe("https://example.com/image.jpg");
  });

  it("falls back to twitter:image", () => {
    const html =
      '<meta name="twitter:image" content="https://example.com/twitter.jpg">';
    expect(extractOgImage(html)).toBe("https://example.com/twitter.jpg");
  });

  it("returns null when no image found", () => {
    const html = "<html><body>No image</body></html>";
    expect(extractOgImage(html)).toBe(null);
  });
});

describe("parsePublishedDate", () => {
  it("parses ISO date strings", () => {
    const result = parsePublishedDate("2024-01-15T10:30:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe("2024-01-15T10:30:00.000Z");
  });

  it("parses date-only strings", () => {
    const result = parsePublishedDate("2024-01-15");
    expect(result).toBeInstanceOf(Date);
  });

  it("returns null for null input", () => {
    expect(parsePublishedDate(null)).toBe(null);
  });

  it("returns null for invalid date strings", () => {
    expect(parsePublishedDate("not a date")).toBe(null);
    expect(parsePublishedDate("")).toBe(null);
  });
});

describe("extractDomain", () => {
  it("extracts domain from URL", () => {
    expect(extractDomain("https://example.com/page")).toBe("example.com");
  });

  it("removes www prefix", () => {
    expect(extractDomain("https://www.example.com/page")).toBe("example.com");
  });

  it("handles subdomains", () => {
    expect(extractDomain("https://blog.example.com/page")).toBe(
      "blog.example.com",
    );
  });

  it("returns empty string for invalid URLs", () => {
    expect(extractDomain("not a url")).toBe("");
  });
});

describe("extractArticleMetadata", () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Page Title</title>
      <meta property="og:title" content="Article Title">
      <meta property="og:description" content="Article description here">
      <meta property="og:image" content="https://example.com/cover.jpg">
      <meta name="author" content="John Doe">
      <meta property="article:published_time" content="2024-01-15T10:30:00Z">
    </head>
    <body></body>
    </html>
  `;

  it("extracts all metadata fields", () => {
    const metadata = extractArticleMetadata(
      sampleHtml,
      "https://www.example.com/article",
    );

    expect(metadata.title).toBe("Article Title");
    expect(metadata.description).toBe("Article description here");
    expect(metadata.author).toBe("John Doe");
    expect(metadata.domain).toBe("example.com");
    expect(metadata.ogImage).toBe("https://example.com/cover.jpg");
    expect(metadata.publishedAt).toBeInstanceOf(Date);
    expect(metadata.publishedAt?.toISOString()).toBe(
      "2024-01-15T10:30:00.000Z",
    );
  });

  it("handles missing optional fields", () => {
    const minimalHtml = "<html><head><title>Title</title></head></html>";
    const metadata = extractArticleMetadata(
      minimalHtml,
      "https://example.com/page",
    );

    expect(metadata.title).toBe("Title");
    expect(metadata.description).toBe(null);
    expect(metadata.author).toBe(null);
    expect(metadata.domain).toBe("example.com");
    expect(metadata.ogImage).toBe(null);
    expect(metadata.publishedAt).toBe(null);
  });

  it("handles real-world HTML with complex formatting", () => {
    const realWorldHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta property="og:title" content="How to Build &amp; Deploy Apps">
        <meta property="og:description" content="Learn the &quot;best practices&quot; for building apps">
        <meta property="og:image" content="https://cdn.example.com/images/cover.jpg?size=large">
        <meta name="author" content="Jane &apos;Dev&apos; Smith">
        <title>How to Build Apps - Example Blog</title>
      </head>
      <body></body>
      </html>
    `;

    const metadata = extractArticleMetadata(
      realWorldHtml,
      "https://blog.example.com/how-to-build",
    );

    expect(metadata.title).toBe("How to Build & Deploy Apps");
    expect(metadata.description).toBe(
      'Learn the "best practices" for building apps',
    );
    expect(metadata.author).toBe("Jane 'Dev' Smith");
    expect(metadata.domain).toBe("blog.example.com");
    expect(metadata.ogImage).toBe(
      "https://cdn.example.com/images/cover.jpg?size=large",
    );
  });
});

describe("extractTweetId", () => {
  it("extracts tweet ID from twitter.com URL", () => {
    expect(
      extractTweetId("https://twitter.com/taylorotwell/status/1234567890"),
    ).toBe("1234567890");
  });

  it("extracts tweet ID from x.com URL", () => {
    expect(extractTweetId("https://x.com/elonmusk/status/9876543210")).toBe(
      "9876543210",
    );
  });

  it("handles URLs with query params", () => {
    expect(
      extractTweetId(
        "https://twitter.com/user/status/1234567890?ref_src=twsrc",
      ),
    ).toBe("1234567890");
  });

  it("returns null for non-tweet URLs", () => {
    expect(extractTweetId("https://twitter.com/user")).toBe(null);
    expect(extractTweetId("https://example.com/status/123")).toBe(null);
  });
});

describe("extractTwitterArticleId", () => {
  it("extracts article ID from twitter.com URL", () => {
    expect(
      extractTwitterArticleId("https://twitter.com/i/article/1234567890"),
    ).toBe("1234567890");
  });

  it("extracts article ID from x.com URL", () => {
    expect(extractTwitterArticleId("https://x.com/i/article/9876543210")).toBe(
      "9876543210",
    );
  });

  it("handles URLs with query params", () => {
    expect(
      extractTwitterArticleId(
        "https://twitter.com/i/article/1234567890?ref=share",
      ),
    ).toBe("1234567890");
  });

  it("returns null for tweet URLs", () => {
    expect(
      extractTwitterArticleId("https://twitter.com/user/status/1234567890"),
    ).toBe(null);
  });

  it("returns null for profile URLs", () => {
    expect(extractTwitterArticleId("https://twitter.com/user")).toBe(null);
    expect(extractTwitterArticleId("https://x.com/user")).toBe(null);
  });

  it("returns null for non-twitter URLs", () => {
    expect(extractTwitterArticleId("https://example.com/i/article/123")).toBe(
      null,
    );
  });
});

describe("preserveSocialEmbeds", () => {
  it("replaces Twitter blockquote embeds with placeholder", () => {
    const html = `
      <p>Check out this tweet:</p>
      <blockquote class="twitter-tweet">
        <p>I'm interested in potentially bringing on someone to focus on video</p>
        <a href="https://twitter.com/taylorotwell/status/1234567890">December 1, 2024</a>
      </blockquote>
      <p>Pretty cool right?</p>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toContain("[[TWEET:1234567890]]");
    expect(result.html).not.toContain('class="twitter-tweet"');
    expect(result.html).toContain("Check out this tweet");
    expect(result.html).toContain("Pretty cool right?");
    expect(result.tweetIds).toEqual(["1234567890"]);
  });

  it("handles x.com URLs", () => {
    const html = `
      <blockquote class="twitter-tweet">
        <p>Some tweet content</p>
        <a href="https://x.com/user/status/9876543210">Date</a>
      </blockquote>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toContain("[[TWEET:9876543210]]");
    expect(result.tweetIds).toEqual(["9876543210"]);
  });

  it("handles multiple embeds", () => {
    const html = `
      <blockquote class="twitter-tweet">
        <a href="https://twitter.com/user1/status/111">Date</a>
      </blockquote>
      <p>Some text</p>
      <blockquote class="twitter-tweet">
        <a href="https://twitter.com/user2/status/222">Date</a>
      </blockquote>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toContain("[[TWEET:111]]");
    expect(result.html).toContain("[[TWEET:222]]");
    expect(result.tweetIds).toEqual(["111", "222"]);
  });

  it("preserves non-twitter blockquotes", () => {
    const html = `
      <blockquote>This is a regular quote</blockquote>
      <blockquote class="twitter-tweet">
        <a href="https://twitter.com/user/status/123">Date</a>
      </blockquote>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toContain("This is a regular quote");
    expect(result.html).toContain("[[TWEET:123]]");
    expect(result.tweetIds).toEqual(["123"]);
  });

  it("leaves twitter blockquotes without valid URLs unchanged", () => {
    const html = `
      <blockquote class="twitter-tweet">
        <p>Some content but no valid tweet link</p>
        <a href="https://example.com/not-a-tweet">Link</a>
      </blockquote>
    `;

    const result = preserveSocialEmbeds(html);

    // Should keep the original blockquote since we couldn't extract a tweet ID
    expect(result.html).toContain('class="twitter-tweet"');
    expect(result.tweetIds).toEqual([]);
  });

  it("handles twitter-tweet class with other classes", () => {
    const html = `
      <blockquote class="twitter-tweet tw-align-center" data-lang="en">
        <p>Tweet content</p>
        <a href="https://twitter.com/user/status/456">Date</a>
      </blockquote>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toContain("[[TWEET:456]]");
    expect(result.tweetIds).toEqual(["456"]);
  });

  it("returns empty tweetIds array when no embeds found", () => {
    const html = "<p>Just regular content, no tweets here.</p>";

    const result = preserveSocialEmbeds(html);

    expect(result.html).toBe(html);
    expect(result.tweetIds).toEqual([]);
  });

  it("detects onclick window.open twitter URLs", () => {
    const html = `
      <div class="tweet-card" onclick="window.open('https://twitter.com/taylorotwell/status/1704117079547257037', '_blank')">
        <img src="avatar.jpg" alt="">
        <div>Taylor Otwell</div>
        <p>I'm interested in potentially bringing on someone...</p>
      </div>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toContain("[[TWEET:1704117079547257037]]");
    expect(result.tweetIds).toEqual(["1704117079547257037"]);
  });

  it("detects onclick with x.com URLs", () => {
    const html = `
      <div onclick="window.open('https://x.com/user/status/9876543210', '_blank')">
        <p>Tweet content here</p>
      </div>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toContain("[[TWEET:9876543210]]");
    expect(result.tweetIds).toEqual(["9876543210"]);
  });

  it("handles complex onclick tweet card like Aaron Francis blog", () => {
    const html = `
      <p>Check out this tweet:</p>
      <div class="relative mx-auto my-12 cursor-pointer overflow-hidden rounded-lg bg-gray-200/60 p-8 transition-colors lg:prose-lg hover:bg-gray-200 prose-p:text-lg prose-p:leading-normal dark:bg-gray-800 hover:dark:bg-gray-700/50" onclick="window.open('https://twitter.com/taylorotwell/status/1704117079547257037', '_blank')">
        <div class="not-prose mb-4 flex items-center gap-4">
          <img src="https://pbs.twimg.com/profile_images/1694737709166899200/EQkjv0gi_400x400.jpg" alt="" class="h-12 w-12 rounded-full">
          <div>
            <p class="text-lg font-semibold !leading-normal">Taylor Otwell</p>
            <p class="text-sm !leading-normal text-gray-500 dark:text-gray-400">taylorotwell</p>
          </div>
        </div>
        <div>I'm interested in potentially bringing on someone to focus on video and educational content at Laravel.</div>
      </div>
      <p>Pretty cool right?</p>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toContain("[[TWEET:1704117079547257037]]");
    expect(result.html).toContain("Check out this tweet");
    expect(result.html).toContain("Pretty cool right?");
    expect(result.tweetIds).toEqual(["1704117079547257037"]);
  });

  it("handles both official embeds and onclick embeds in same HTML", () => {
    const html = `
      <blockquote class="twitter-tweet">
        <a href="https://twitter.com/user1/status/111">Date</a>
      </blockquote>
      <p>Some text</p>
      <div onclick="window.open('https://twitter.com/user2/status/222', '_blank')">
        <p>Custom tweet card</p>
      </div>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toContain("[[TWEET:111]]");
    expect(result.html).toContain("[[TWEET:222]]");
    expect(result.tweetIds).toEqual(["111", "222"]);
  });

  it("does not duplicate tweet IDs when same tweet appears multiple ways", () => {
    const html = `
      <blockquote class="twitter-tweet">
        <a href="https://twitter.com/user/status/123">Date</a>
      </blockquote>
      <div onclick="window.open('https://twitter.com/user/status/123', '_blank')">
        <p>Same tweet as card</p>
      </div>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.tweetIds).toEqual(["123"]);
  });

  it("ignores onclick without twitter URLs", () => {
    const html = `
      <div onclick="window.open('https://example.com/page', '_blank')">
        <p>Regular clickable div</p>
      </div>
    `;

    const result = preserveSocialEmbeds(html);

    expect(result.html).toBe(html);
    expect(result.tweetIds).toEqual([]);
  });

  describe("real-world fixtures", () => {
    it("correctly processes Aaron Francis blog tweet embeds", () => {
      // This fixture contains the onclick tweet embed pattern from aaronfrancis.com
      // Source: https://aaronfrancis.com/2024/what-if-you-tried-hard-dac139a5
      const result = preserveSocialEmbeds(aaronFrancisFixture);

      // Should detect both tweet IDs
      expect(result.tweetIds).toEqual([
        "1704117079547257037",
        "1770253702391026010",
      ]);

      // Should replace onclick divs with tweet markers
      expect(result.html).toContain("[[TWEET:1704117079547257037]]");
      expect(result.html).toContain("[[TWEET:1770253702391026010]]");

      // Tweet content should be removed (it was inside the onclick divs)
      expect(result.html).not.toContain(
        "I'm interested in potentially bringing on someone",
      );
      expect(result.html).not.toContain(
        "being willing to relocate is a massively underrated",
      );

      // Regular article content should remain
      expect(result.html).toContain("What if you tried hard?");
      expect(result.html).toContain(
        "In this case, trying hard could be making a video",
      );
      expect(result.html).toContain("Trying hard is really not that hard.");
    });
  });
});

// --- Product metadata extraction tests ---

describe("extractOgType", () => {
  it("extracts og:type value", () => {
    const html = '<meta property="og:type" content="product">';
    expect(extractOgType(html)).toBe("product");
  });

  it("returns null when not present", () => {
    const html = "<html><head></head></html>";
    expect(extractOgType(html)).toBeNull();
  });
});

describe("extractJsonLdProduct", () => {
  it("extracts product data from JSON-LD", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Test Product",
          "brand": { "name": "TestBrand" },
          "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
          "offers": {
            "price": "29.99",
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock"
          }
        }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result).not.toBeNull();
    expect(result?.price).toBe("29.99");
    expect(result?.currency).toBe("USD");
    expect(result?.brand).toBe("TestBrand");
    expect(result?.availability).toBe("InStock");
    expect(result?.images).toEqual([
      "https://example.com/img1.jpg",
      "https://example.com/img2.jpg",
    ]);
  });

  it("handles Product inside @graph", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@graph": [
            { "@type": "WebPage", "name": "Page" },
            {
              "@type": "Product",
              "name": "Graph Product",
              "brand": "SimpleBrand",
              "offers": { "price": "49.99", "priceCurrency": "GBP" }
            }
          ]
        }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.price).toBe("49.99");
    expect(result?.currency).toBe("GBP");
    expect(result?.brand).toBe("SimpleBrand");
  });

  it("handles single image string", () => {
    const html = `
      <script type="application/ld+json">
        { "@type": "Product", "image": "https://example.com/single.jpg", "offers": {} }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.images).toEqual(["https://example.com/single.jpg"]);
  });

  it("returns null for non-product JSON-LD", () => {
    const html = `
      <script type="application/ld+json">
        { "@type": "Article", "name": "Blog Post" }
      </script>
    `;
    expect(extractJsonLdProduct(html)).toBeNull();
  });

  it("handles offers as an array (picks first)", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "offers": [
            { "price": "19.99", "priceCurrency": "USD" },
            { "price": "24.99", "priceCurrency": "EUR" }
          ]
        }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.price).toBe("19.99");
    expect(result?.currency).toBe("USD");
  });

  it("falls back to lowPrice when price is absent", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "offers": { "lowPrice": "14.99", "priceCurrency": "GBP" }
        }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.price).toBe("14.99");
  });

  it("handles image as object with url property", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "image": { "url": "https://example.com/obj.jpg" },
          "offers": {}
        }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.images).toEqual(["https://example.com/obj.jpg"]);
  });

  it("handles image array with mixed strings and objects", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "image": [
            "https://example.com/str.jpg",
            { "url": "https://example.com/obj.jpg" }
          ],
          "offers": {}
        }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.images).toEqual([
      "https://example.com/str.jpg",
      "https://example.com/obj.jpg",
    ]);
  });

  it("finds Product in second JSON-LD script when first is not Product", () => {
    const html = `
      <script type="application/ld+json">
        { "@type": "Organization", "name": "Shop Inc" }
      </script>
      <script type="application/ld+json">
        { "@type": "Product", "brand": "Found", "offers": { "price": "5.00", "priceCurrency": "USD" } }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.brand).toBe("Found");
    expect(result?.price).toBe("5.00");
  });

  it("returns null availability when not provided", () => {
    const html = `
      <script type="application/ld+json">
        { "@type": "Product", "offers": { "price": "10" } }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.availability).toBeNull();
  });

  it("handles no image field", () => {
    const html = `
      <script type="application/ld+json">
        { "@type": "Product", "offers": { "price": "10" } }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.images).toEqual([]);
  });

  it("handles numeric price values", () => {
    const html = `
      <script type="application/ld+json">
        { "@type": "Product", "offers": { "price": 42.5, "priceCurrency": "USD" } }
      </script>
    `;
    const result = extractJsonLdProduct(html);
    expect(result?.price).toBe("42.5");
  });

  it("handles invalid JSON gracefully", () => {
    const html = `
      <script type="application/ld+json">
        { invalid json here
      </script>
    `;
    expect(extractJsonLdProduct(html)).toBeNull();
  });
});

describe("extractProductImageUrls", () => {
  it("collects images from JSON-LD and og:image", () => {
    const html = `
      <meta property="og:image" content="https://example.com/og.jpg">
      <script type="application/ld+json">
        { "@type": "Product", "image": ["https://example.com/product1.jpg"], "offers": {} }
      </script>
    `;
    const urls = extractProductImageUrls(html);
    expect(urls).toContain("https://example.com/product1.jpg");
    expect(urls).toContain("https://example.com/og.jpg");
  });

  it("deduplicates URLs", () => {
    const html = `
      <meta property="og:image" content="https://example.com/same.jpg">
      <script type="application/ld+json">
        { "@type": "Product", "image": ["https://example.com/same.jpg"], "offers": {} }
      </script>
    `;
    const urls = extractProductImageUrls(html);
    expect(urls).toEqual(["https://example.com/same.jpg"]);
  });

  it("collects multiple og:image tags", () => {
    const html = `
      <meta property="og:image" content="https://example.com/img1.jpg">
      <meta property="og:image" content="https://example.com/img2.jpg">
    `;
    const urls = extractProductImageUrls(html);
    expect(urls).toEqual([
      "https://example.com/img1.jpg",
      "https://example.com/img2.jpg",
    ]);
  });
});

describe("extractAllProductImageCandidates", () => {
  const baseUrl = "https://shop.example.com/p/widget";

  it("collects from img src, srcset, source srcset, og, JSON-LD, preload", () => {
    const html = `
      <meta property="og:image" content="https://shop.example.com/og.jpg">
      <link rel="preload" as="image" href="https://shop.example.com/preload.jpg">
      <script type="application/ld+json">
        { "@type": "Product", "image": ["https://shop.example.com/jsonld.jpg"], "offers": {} }
      </script>
      <picture>
        <source srcset="https://shop.example.com/source-large.jpg 1200w, https://shop.example.com/source-small.jpg 300w">
        <img src="https://shop.example.com/hero.jpg" srcset="https://shop.example.com/hero-2x.jpg 2x">
      </picture>
      <img data-src="https://shop.example.com/lazy.jpg">
    `;
    const result = extractAllProductImageCandidates(html, baseUrl);
    const urls = result.map((c) => c.url);
    expect(urls).toContain("https://shop.example.com/jsonld.jpg");
    expect(urls).toContain("https://shop.example.com/og.jpg");
    expect(urls).toContain("https://shop.example.com/preload.jpg");
    expect(urls).toContain("https://shop.example.com/source-large.jpg");
    expect(urls).toContain("https://shop.example.com/source-small.jpg");
    expect(urls).toContain("https://shop.example.com/hero.jpg");
    expect(urls).toContain("https://shop.example.com/hero-2x.jpg");
    expect(urls).toContain("https://shop.example.com/lazy.jpg");
  });

  it("tags source correctly: json-ld > og > dom", () => {
    const html = `
      <meta property="og:image" content="https://example.com/og-only.jpg">
      <script type="application/ld+json">
        { "@type": "Product", "image": ["https://example.com/jsonld-only.jpg"], "offers": {} }
      </script>
      <img src="https://example.com/dom-only.jpg">
    `;
    const result = extractAllProductImageCandidates(html, baseUrl);
    const byUrl = Object.fromEntries(result.map((c) => [c.url, c.source]));
    expect(byUrl["https://example.com/jsonld-only.jpg"]).toBe("json-ld");
    expect(byUrl["https://example.com/og-only.jpg"]).toBe("og");
    expect(byUrl["https://example.com/dom-only.jpg"]).toBe("dom");
  });

  it("upgrades source to highest-priority when same image appears multiple times", () => {
    const html = `
      <img src="https://example.com/photo.jpg">
      <script type="application/ld+json">
        { "@type": "Product", "image": ["https://example.com/photo.jpg"], "offers": {} }
      </script>
    `;
    const result = extractAllProductImageCandidates(html, baseUrl);
    const photo = result.find((c) => c.url === "https://example.com/photo.jpg");
    expect(photo?.source).toBe("json-ld");
  });

  it("filters obvious junk URLs", () => {
    const html = `
      <img src="https://cdn.example.com/payment-visa.png">
      <img src="https://cdn.example.com/social-icon-twitter.png">
      <img src="https://cdn.example.com/site-logo.png">
      <img src="https://cdn.example.com/sprite-sheet.png">
      <img src="https://cdn.example.com/favicon.ico">
      <img src="https://cdn.example.com/spacer.gif">
      <img src="https://cdn.example.com/real-product.jpg">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toEqual(["https://cdn.example.com/real-product.jpg"]);
  });

  it("filters SVG, GIF, and data URIs", () => {
    const html = `
      <img src="https://cdn.example.com/icon.svg">
      <img src="https://cdn.example.com/animation.gif">
      <img src="data:image/png;base64,iVBORw0KG">
      <img src="https://cdn.example.com/photo.jpg">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toEqual(["https://cdn.example.com/photo.jpg"]);
  });

  it("dedupes responsive variants and keeps the largest by URL hint", () => {
    const html = `
      <img src="https://cdn.example.com/photo.jpg?width=300">
      <img src="https://cdn.example.com/photo.jpg?width=1200">
      <img src="https://cdn.example.com/photo.jpg?width=600">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toEqual(["https://cdn.example.com/photo.jpg?width=1200"]);
  });

  it("dedupes path-embedded size suffixes", () => {
    const html = `
      <img src="https://cdn.example.com/photo-300x300.jpg">
      <img src="https://cdn.example.com/photo-1200x1200.jpg">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://cdn.example.com/photo-1200x1200.jpg");
  });

  it("dedupes width-only Nw variants and keeps the largest", () => {
    const html = `
      <img src="https://cdn.example.com/photo-300w.jpg">
      <img src="https://cdn.example.com/photo-1200w.jpg">
      <img src="https://cdn.example.com/photo-600w.jpg">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toEqual(["https://cdn.example.com/photo-1200w.jpg"]);
  });

  it("dedupes retina @Nx variants", () => {
    const html = `
      <img src="https://cdn.example.com/hero@1x.jpg">
      <img src="https://cdn.example.com/hero@2x.jpg">
      <img src="https://cdn.example.com/hero@3x.jpg">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toHaveLength(1);
  });

  it("does not strip Nw inside arbitrary words", () => {
    const html = `
      <img src="https://cdn.example.com/photo-1200wide.jpg">
      <img src="https://cdn.example.com/photo-1200w.jpg">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toContain("https://cdn.example.com/photo-1200wide.jpg");
    expect(urls).toContain("https://cdn.example.com/photo-1200w.jpg");
  });

  it("resolves relative URLs against base", () => {
    const html = `<img src="/img/photo.jpg">`;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toEqual(["https://shop.example.com/img/photo.jpg"]);
  });

  it("caps at 50 candidates", () => {
    const imgs = Array.from(
      { length: 80 },
      (_, i) => `<img src="https://cdn.example.com/photo-${i}.jpg">`,
    ).join("\n");
    const result = extractAllProductImageCandidates(imgs, baseUrl);
    expect(result).toHaveLength(50);
  });

  it("returns empty for HTML with no images", () => {
    const html = "<html><body><p>No images here</p></body></html>";
    expect(extractAllProductImageCandidates(html, baseUrl)).toEqual([]);
  });

  it("does not false-positive on legitimate names containing junk substrings", () => {
    const html = `
      <img src="https://cdn.example.com/iconic-chair.jpg">
      <img src="https://cdn.example.com/logos-tee.jpg">
      <img src="https://cdn.example.com/striped-shirt.jpg">
      <img src="https://cdn.example.com/discovery-bundle.jpg">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toEqual([
      "https://cdn.example.com/iconic-chair.jpg",
      "https://cdn.example.com/logos-tee.jpg",
      "https://cdn.example.com/striped-shirt.jpg",
      "https://cdn.example.com/discovery-bundle.jpg",
    ]);
  });

  it("extracts <img> inside <noscript> (lazy-load fallback pattern)", () => {
    const html = `
      <img src="https://cdn.example.com/lazy-placeholder.jpg" data-src="https://cdn.example.com/lazy-real.jpg">
      <noscript>
        <img src="https://cdn.example.com/noscript-real.jpg">
      </noscript>
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toContain("https://cdn.example.com/noscript-real.jpg");
    expect(urls).toContain("https://cdn.example.com/lazy-real.jpg");
  });

  it("ignores images inside HTML comments", () => {
    const html = `
      <!-- <img src="https://cdn.example.com/commented-out-ad.jpg"> -->
      <img src="https://cdn.example.com/real-product.jpg">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toEqual(["https://cdn.example.com/real-product.jpg"]);
  });

  it("handles JSON-LD ImageObject form", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "image": [
            { "@type": "ImageObject", "url": "https://example.com/obj1.jpg" },
            { "@type": "ImageObject", "url": "https://example.com/obj2.jpg" }
          ],
          "offers": {}
        }
      </script>
    `;
    const result = extractAllProductImageCandidates(html, baseUrl);
    const urls = result.map((c) => c.url);
    expect(urls).toContain("https://example.com/obj1.jpg");
    expect(urls).toContain("https://example.com/obj2.jpg");
    expect(result.every((c) => c.source === "json-ld")).toBe(true);
  });

  it("handles self-closing <img /> and uppercase <IMG SRC>", () => {
    const html = `
      <img src="https://example.com/self-close.jpg" />
      <IMG SRC="https://example.com/uppercase.jpg">
    `;
    const urls = extractAllProductImageCandidates(html, baseUrl).map(
      (c) => c.url,
    );
    expect(urls).toContain("https://example.com/self-close.jpg");
    expect(urls).toContain("https://example.com/uppercase.jpg");
  });
});

describe("extractProductMetadata", () => {
  it("detects product via og:type", () => {
    const html = `
      <meta property="og:type" content="product">
      <meta property="og:title" content="Cool Product">
      <meta property="og:image" content="https://example.com/img.jpg">
      <meta property="product:price:amount" content="19.99">
      <meta property="product:price:currency" content="EUR">
      <meta property="product:brand" content="BrandX">
    `;
    const result = extractProductMetadata(html, "https://example.com/product");
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Cool Product");
    expect(result?.price).toBe("19.99");
    expect(result?.currency).toBe("EUR");
    expect(result?.brand).toBe("BrandX");
    expect(result?.domain).toBe("example.com");
  });

  it("detects product via JSON-LD only", () => {
    const html = `
      <title>Turntable</title>
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "AT-LP120XUSB",
          "brand": { "name": "Audio-Technica" },
          "image": ["https://example.com/turntable.jpg"],
          "offers": {
            "price": "349.00",
            "priceCurrency": "GBP",
            "availability": "https://schema.org/InStock"
          }
        }
      </script>
    `;
    const result = extractProductMetadata(
      html,
      "https://audio-technica.com/product",
    );
    expect(result).not.toBeNull();
    expect(result?.price).toBe("349.00");
    expect(result?.currency).toBe("GBP");
    expect(result?.brand).toBe("Audio-Technica");
    expect(result?.availability).toBe("InStock");
  });

  it("detects product via product OG meta tags only", () => {
    const html = `
      <meta property="og:type" content="website">
      <meta property="product:price:amount" content="99.99">
      <meta property="product:price:currency" content="USD">
    `;
    const result = extractProductMetadata(
      html,
      "https://shop.example.com/item",
    );
    expect(result).not.toBeNull();
    expect(result?.price).toBe("99.99");
    expect(result?.currency).toBe("USD");
  });

  it("returns null for non-product pages", () => {
    const html = `
      <meta property="og:type" content="article">
      <meta property="og:title" content="Blog Post">
    `;
    const result = extractProductMetadata(
      html,
      "https://blog.example.com/post",
    );
    expect(result).toBeNull();
  });

  it("returns null for plain HTML with no product signals", () => {
    const html =
      "<html><head><title>Hello</title></head><body>Hi</body></html>";
    expect(extractProductMetadata(html, "https://example.com")).toBeNull();
  });

  it("prefers JSON-LD data over OG meta tags", () => {
    const html = `
      <meta property="og:type" content="product">
      <meta property="product:price:amount" content="10.00">
      <meta property="product:price:currency" content="USD">
      <script type="application/ld+json">
        {
          "@type": "Product",
          "offers": { "price": "9.99", "priceCurrency": "EUR" },
          "brand": { "name": "JsonBrand" }
        }
      </script>
    `;
    const result = extractProductMetadata(html, "https://example.com/p");
    expect(result?.price).toBe("9.99");
    expect(result?.currency).toBe("EUR");
    expect(result?.brand).toBe("JsonBrand");
  });

  it("detects product.item og:type", () => {
    const html = '<meta property="og:type" content="product.item">';
    const result = extractProductMetadata(html, "https://example.com/p");
    expect(result).not.toBeNull();
  });

  it("detects product.group og:type", () => {
    const html = '<meta property="og:type" content="product.group">';
    const result = extractProductMetadata(html, "https://example.com/p");
    expect(result).not.toBeNull();
  });

  it("does not detect og:type=website as product", () => {
    const html = '<meta property="og:type" content="website">';
    expect(extractProductMetadata(html, "https://example.com")).toBeNull();
  });

  it("handles product with no images at all", () => {
    const html = `
      <meta property="og:type" content="product">
      <meta property="product:price:amount" content="5.00">
    `;
    const result = extractProductMetadata(html, "https://example.com/p");
    expect(result).not.toBeNull();
    expect(result?.imageUrls).toEqual([]);
    expect(result?.ogImage).toBeNull();
    expect(result?.price).toBe("5.00");
  });

  it("extracts title and description for product pages", () => {
    const html = `
      <meta property="og:type" content="product">
      <meta property="og:title" content="Amazing Widget">
      <meta property="og:description" content="The best widget ever">
    `;
    const result = extractProductMetadata(html, "https://example.com/widget");
    expect(result?.title).toBe("Amazing Widget");
    expect(result?.description).toBe("The best widget ever");
  });

  it("falls back to OG brand when JSON-LD has no brand", () => {
    const html = `
      <meta property="og:type" content="product">
      <meta property="product:brand" content="OgBrand">
    `;
    const result = extractProductMetadata(html, "https://example.com/p");
    expect(result?.brand).toBe("OgBrand");
  });

  it("detects product with only product:price:currency tag", () => {
    const html = `
      <meta property="product:price:currency" content="GBP">
    `;
    const result = extractProductMetadata(html, "https://example.com/p");
    expect(result).not.toBeNull();
    expect(result?.currency).toBe("GBP");
  });

  it("detects product via known URL pattern even without structured data", () => {
    const html = `<html><head><title>Cool Widget</title></head><body></body></html>`;
    const result = extractProductMetadata(
      html,
      "https://www.amazon.com/Cool-Widget/dp/B08N5WRWNW",
    );
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Cool Widget");
  });

  it("returns null for non-product page on known domain", () => {
    const html = `<html><head><title>Search Results</title></head><body></body></html>`;
    const result = extractProductMetadata(
      html,
      "https://www.amazon.com/s?k=laptop",
    );
    expect(result).toBeNull();
  });
});

describe("isKnownProductUrl", () => {
  describe("US / Global platforms", () => {
    it("matches Amazon product URLs", () => {
      expect(
        isKnownProductUrl("https://www.amazon.com/Apple-MacBook/dp/B0DL2GFJHP"),
      ).toBe(true);
      expect(
        isKnownProductUrl("https://www.amazon.co.uk/gp/product/B08N5WRWNW"),
      ).toBe(true);
      expect(isKnownProductUrl("https://amazon.de/gp/aw/d/B08N5WRWNW")).toBe(
        true,
      );
    });

    it("rejects Amazon non-product pages", () => {
      expect(isKnownProductUrl("https://www.amazon.com/s?k=laptop")).toBe(
        false,
      );
      expect(isKnownProductUrl("https://www.amazon.com/gp/bestsellers/")).toBe(
        false,
      );
      expect(isKnownProductUrl("https://www.amazon.com/")).toBe(false);
    });

    it("matches eBay product URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.ebay.com/itm/Apple-MacBook/123456789012",
        ),
      ).toBe(true);
      expect(isKnownProductUrl("https://www.ebay.co.uk/itm/123456789012")).toBe(
        true,
      );
    });

    it("rejects eBay non-product pages", () => {
      expect(
        isKnownProductUrl("https://www.ebay.com/sch/i.html?_nkw=laptop"),
      ).toBe(false);
    });

    it("matches Etsy listing URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.etsy.com/listing/1234567890/handmade-ceramic-mug",
        ),
      ).toBe(true);
    });

    it("rejects Etsy non-product pages", () => {
      expect(isKnownProductUrl("https://www.etsy.com/shop/StoreName")).toBe(
        false,
      );
      expect(isKnownProductUrl("https://www.etsy.com/search?q=mugs")).toBe(
        false,
      );
    });

    it("matches Walmart product URLs", () => {
      expect(
        isKnownProductUrl("https://www.walmart.com/ip/Apple-AirPods/720991369"),
      ).toBe(true);
    });

    it("rejects Walmart non-product pages", () => {
      expect(
        isKnownProductUrl("https://www.walmart.com/browse/electronics/3944"),
      ).toBe(false);
    });

    it("matches Target product URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.target.com/p/apple-airpods/-/A-85978612",
        ),
      ).toBe(true);
    });

    it("matches Best Buy product URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.bestbuy.com/site/apple-macbook/6534606.p?skuId=6534606",
        ),
      ).toBe(true);
    });

    it("rejects Best Buy category pages", () => {
      expect(
        isKnownProductUrl(
          "https://www.bestbuy.com/site/computers/abcat0500000.c",
        ),
      ).toBe(false);
    });

    it("matches AliExpress product URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.aliexpress.com/item/1005006123456789.html",
        ),
      ).toBe(true);
    });

    it("matches ASOS product URLs", () => {
      expect(
        isKnownProductUrl("https://www.asos.com/nike/air-max/prd/204512345"),
      ).toBe(true);
    });

    it("matches Wayfair product URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.wayfair.com/furniture/pdp/some-product-W001234567.html",
        ),
      ).toBe(true);
    });

    it("matches Temu product URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.temu.com/some-product-g-601099512345678.html",
        ),
      ).toBe(true);
    });
  });

  describe("UK platforms", () => {
    it("matches John Lewis product URLs", () => {
      expect(
        isKnownProductUrl("https://www.johnlewis.com/p/samsung-tv/p6789012"),
      ).toBe(true);
    });

    it("rejects John Lewis browse pages", () => {
      expect(
        isKnownProductUrl(
          "https://www.johnlewis.com/browse/electricals/televisions",
        ),
      ).toBe(false);
    });

    it("matches Argos product URLs", () => {
      expect(isKnownProductUrl("https://www.argos.co.uk/product/1234567")).toBe(
        true,
      );
    });

    it("rejects Argos browse pages", () => {
      expect(
        isKnownProductUrl("https://www.argos.co.uk/browse/technology/c:30101"),
      ).toBe(false);
    });

    it("matches Currys product URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.currys.co.uk/products/samsung-galaxy-12345.html",
        ),
      ).toBe(true);
    });

    it("matches M&S product URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.marksandspencer.com/oxford-shirt/p/P60610288",
        ),
      ).toBe(true);
    });

    it("rejects M&S category pages", () => {
      expect(
        isKnownProductUrl("https://www.marksandspencer.com/l/men/shirts"),
      ).toBe(false);
    });

    it("matches Selfridges product URLs", () => {
      expect(
        isKnownProductUrl(
          "https://www.selfridges.com/GB/en/product/gucci-trainers_R03748939",
        ),
      ).toBe(true);
    });

    it("matches Boots product URLs", () => {
      expect(
        isKnownProductUrl("https://www.boots.com/product/no7-serum-10308765"),
      ).toBe(true);
    });

    it("matches Next product URLs", () => {
      expect(
        isKnownProductUrl("https://www.next.co.uk/style/st123456/product-name"),
      ).toBe(true);
    });

    it("rejects Next category pages", () => {
      expect(
        isKnownProductUrl(
          "https://www.next.co.uk/shop/gender-women-category-dresses",
        ),
      ).toBe(false);
    });

    it("matches Screwfix product URLs", () => {
      expect(
        isKnownProductUrl("https://www.screwfix.com/p/bosch-drill/12345"),
      ).toBe(true);
    });
  });

  describe("Generic patterns", () => {
    it("matches Shopify /products/ pattern on myshopify.com", () => {
      expect(
        isKnownProductUrl(
          "https://cool-store.myshopify.com/products/cool-widget",
        ),
      ).toBe(true);
    });

    it("matches Shopify /products/ pattern on custom domains", () => {
      expect(
        isKnownProductUrl("https://www.allbirds.com/products/tree-runners"),
      ).toBe(true);
    });

    it("matches WooCommerce /product/ pattern", () => {
      expect(
        isKnownProductUrl("https://www.somestore.com/product/blue-widget"),
      ).toBe(true);
    });

    it("rejects Shopify collection pages", () => {
      expect(
        isKnownProductUrl("https://cool-store.myshopify.com/collections/all"),
      ).toBe(false);
    });

    it("rejects generic blog URLs", () => {
      expect(isKnownProductUrl("https://www.example.com/blog/my-post")).toBe(
        false,
      );
    });

    it("rejects non-e-commerce URLs", () => {
      expect(
        isKnownProductUrl("https://www.nytimes.com/2024/01/01/article"),
      ).toBe(false);
      expect(isKnownProductUrl("https://github.com/user/repo")).toBe(false);
    });
  });
});

describe("inferCurrencyFromPriceContext", () => {
  describe("prefix symbols", () => {
    it("resolves £ to GBP", () => {
      expect(inferCurrencyFromPriceContext("£299.99", "299.99")).toBe("GBP");
    });

    it("resolves $ to USD", () => {
      expect(inferCurrencyFromPriceContext("$299.99", "299.99")).toBe("USD");
    });

    it("resolves € to EUR", () => {
      expect(inferCurrencyFromPriceContext("€299.99", "299.99")).toBe("EUR");
    });

    it("resolves ¥ to JPY", () => {
      expect(inferCurrencyFromPriceContext("¥1200", "1200")).toBe("JPY");
    });

    it("resolves ₹ to INR", () => {
      expect(inferCurrencyFromPriceContext("₹1500", "1500")).toBe("INR");
    });

    it("resolves ₩ to KRW", () => {
      expect(inferCurrencyFromPriceContext("₩50000", "50000")).toBe("KRW");
    });

    it("tolerates whitespace between symbol and price", () => {
      expect(inferCurrencyFromPriceContext("£ 299.99", "299.99")).toBe("GBP");
    });
  });

  describe("multi-character prefix symbols", () => {
    it("resolves CA$ to CAD (not USD)", () => {
      expect(inferCurrencyFromPriceContext("CA$299.99", "299.99")).toBe("CAD");
    });

    it("resolves R$ to BRL (not USD)", () => {
      expect(inferCurrencyFromPriceContext("R$299.99", "299.99")).toBe("BRL");
    });

    it("resolves A$ to AUD (not USD)", () => {
      expect(inferCurrencyFromPriceContext(" A$299.99", "299.99")).toBe("AUD");
    });

    it("resolves NZ$ to NZD", () => {
      expect(inferCurrencyFromPriceContext("NZ$299.99", "299.99")).toBe("NZD");
    });

    it("resolves CHF prefix to CHF", () => {
      expect(inferCurrencyFromPriceContext("CHF 299.99", "299.99")).toBe("CHF");
    });
  });

  describe("postfix symbols", () => {
    it("resolves trailing € to EUR (French/German format)", () => {
      expect(inferCurrencyFromPriceContext("299,99 €", "299.99")).toBe("EUR");
    });

    it("resolves trailing £ to GBP", () => {
      expect(inferCurrencyFromPriceContext("299.99£", "299.99")).toBe("GBP");
    });
  });

  describe("ISO codes", () => {
    it("resolves prefix ISO code to currency", () => {
      expect(inferCurrencyFromPriceContext("USD 299.99", "299.99")).toBe("USD");
    });

    it("resolves postfix ISO code to currency", () => {
      expect(inferCurrencyFromPriceContext("299.99 GBP", "299.99")).toBe("GBP");
    });

    it("ignores ISO-shaped substrings inside longer words", () => {
      // "STATUS" ends in "TUS" — not an ISO code
      expect(inferCurrencyFromPriceContext("STATUS 299.99", "299.99")).toBe(
        null,
      );
    });

    it("ignores ISO codes that are not real currencies", () => {
      expect(inferCurrencyFromPriceContext("XYZ 299.99", "299.99")).toBe(null);
    });

    it("rejects ISO code glued to a preceding letter", () => {
      // "TheUSD" should not resolve, even though "USD" appears at the end
      expect(inferCurrencyFromPriceContext("TheUSD 299.99", "299.99")).toBe(
        null,
      );
    });
  });

  describe("HTML markup", () => {
    it("looks through tag boundaries", () => {
      const html = '<span class="symbol">£</span><span>299.99</span>';
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe("GBP");
    });

    it("decodes named HTML entities", () => {
      const html = "<p>&pound;299.99</p>";
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe("GBP");
    });

    it("decodes &euro; entity", () => {
      const html = "<p>&euro;299.99</p>";
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe("EUR");
    });

    it("decodes numeric HTML entities", () => {
      // &#163; = £
      const html = "<p>&#163;299.99</p>";
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe("GBP");
    });

    it("decodes hex HTML entities", () => {
      // &#xA3; = £
      const html = "<p>&#xA3;299.99</p>";
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe("GBP");
    });

    it("prefers an occurrence with an adjacent symbol over one without", () => {
      const html = `
        <meta property="product:price:amount" content="299.99" />
        <span class="price">£299.99</span>
      `;
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe("GBP");
    });
  });

  describe("locale price formatting", () => {
    it("matches a price formatted with comma thousand separators", () => {
      const html = "<span>$1,299.99</span>";
      expect(inferCurrencyFromPriceContext(html, "1299.99")).toBe("USD");
    });

    it("matches a price formatted with dot thousand separators", () => {
      // German format: 1.299,99 €
      const html = "<span>1.299,99 €</span>";
      expect(inferCurrencyFromPriceContext(html, "1299.99")).toBe("EUR");
    });

    it("matches a price formatted with space thousand separators", () => {
      // French format: 1 299,99 €
      const html = "<span>1 299,99 €</span>";
      expect(inferCurrencyFromPriceContext(html, "1299.99")).toBe("EUR");
    });
  });

  describe("boundary handling", () => {
    it("does not match a price that is part of a larger number", () => {
      // Looking for "299.99" should not match inside "1299.99"
      const html = "<span>1299.99</span>";
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe(null);
    });

    it("does not match when price is preceded by another digit", () => {
      const html = "<span>£12345.99</span>";
      expect(inferCurrencyFromPriceContext(html, "5.99")).toBe(null);
    });

    it("rejects a single-char symbol glued to a preceding letter", () => {
      // "BANANAS$299" should not resolve to USD
      const html = "BANANAS$299.99";
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe(null);
    });
  });

  describe("no signal", () => {
    it("returns null when no symbol or ISO code is adjacent", () => {
      const html =
        '<meta property="product:price:amount" content="299.99" /><script>{"price":299.99}</script>';
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe(null);
    });

    it("returns null for empty price", () => {
      expect(inferCurrencyFromPriceContext("£299.99", "")).toBe(null);
    });

    it("returns null for empty html", () => {
      expect(inferCurrencyFromPriceContext("", "299.99")).toBe(null);
    });

    it("returns null when symbol is too far from price", () => {
      const html = `£${" ".repeat(200)}299.99`;
      expect(inferCurrencyFromPriceContext(html, "299.99")).toBe(null);
    });
  });

  describe("real-world fixture (audio-technica.com Magento/Hyva storefront)", () => {
    it('recovers GBP from the visible <span class="price">£299.99</span>', () => {
      expect(
        inferCurrencyFromPriceContext(audioTechnicaFixture, "299.99"),
      ).toBe("GBP");
    });

    it("end-to-end via extractProductMetadata", () => {
      const result = extractProductMetadata(
        audioTechnicaFixture,
        "https://www.audio-technica.com/en-gb/at-lp120xusb",
      );
      expect(result).not.toBeNull();
      expect(result?.price).toBe("299.99");
      expect(result?.currency).toBe("GBP");
    });
  });
});

describe("isKnownBookUrl", () => {
  it("matches Goodreads book pages", () => {
    expect(
      isKnownBookUrl("https://www.goodreads.com/book/show/12345.The_Book"),
    ).toBe(true);
  });

  it("matches Open Library work pages", () => {
    expect(isKnownBookUrl("https://openlibrary.org/works/OL45804W")).toBe(true);
  });

  it("matches Google Books pages", () => {
    expect(isKnownBookUrl("https://books.google.com/books?id=abc123")).toBe(
      true,
    );
  });

  it("does not match a Goodreads search page", () => {
    expect(isKnownBookUrl("https://www.goodreads.com/search?q=dune")).toBe(
      false,
    );
  });

  it("does not match arbitrary domains", () => {
    expect(isKnownBookUrl("https://example.com/some/page")).toBe(false);
  });
});

describe("extractBookMetadata", () => {
  it("detects a book via og:type=book with OG book tags", () => {
    const html = `
      <meta property="og:type" content="book">
      <meta property="og:title" content="The Pragmatic Programmer">
      <meta property="og:image" content="https://example.com/cover.jpg">
      <meta property="book:isbn" content="9780135957059">
      <meta property="book:release_date" content="2019-09-13">
    `;
    const result = extractBookMetadata(html, "https://example.com/book/123");
    expect(result).not.toBeNull();
    expect(result?.title).toBe("The Pragmatic Programmer");
    expect(result?.isbn).toBe("9780135957059");
    expect(result?.ogImage).toBe("https://example.com/cover.jpg");
    expect(result?.publishedAt?.getFullYear()).toBe(2019);
    expect(result?.domain).toBe("example.com");
  });

  it("detects a book via JSON-LD and extracts rich metadata", () => {
    const html = `
      <title>Dune</title>
      <script type="application/ld+json">
        {
          "@type": "Book",
          "name": "Dune",
          "author": [{ "@type": "Person", "name": "Frank Herbert" }],
          "isbn": "9780441013593",
          "numberOfPages": 412,
          "datePublished": "1965-08-01",
          "publisher": { "@type": "Organization", "name": "Chilton Books" },
          "image": "https://example.com/dune.jpg",
          "description": "A stunning blend of adventure and mysticism."
        }
      </script>
    `;
    const result = extractBookMetadata(
      html,
      "https://www.goodreads.com/book/show/44767458",
    );
    expect(result).not.toBeNull();
    expect(result?.authors).toEqual(["Frank Herbert"]);
    expect(result?.isbn).toBe("9780441013593");
    expect(result?.pageCount).toBe(412);
    expect(result?.publisher).toBe("Chilton Books");
    expect(result?.publishedAt?.getFullYear()).toBe(1965);
    expect(result?.description).toBe(
      "A stunning blend of adventure and mysticism.",
    );
  });

  it("supports the Goodreads books:* OG namespace and @type array", () => {
    const html = `
      <meta property="og:type" content="books.book">
      <meta property="og:title" content="Project Hail Mary">
      <meta property="books:isbn" content="9780593135204">
      <meta property="books:page_count" content="496">
      <script type="application/ld+json">
        { "@type": ["Book", "Product"], "author": "Andy Weir" }
      </script>
    `;
    const result = extractBookMetadata(
      html,
      "https://www.goodreads.com/book/show/54493401",
    );
    expect(result).not.toBeNull();
    expect(result?.authors).toEqual(["Andy Weir"]);
    expect(result?.isbn).toBe("9780593135204");
    expect(result?.pageCount).toBe(496);
  });

  it("ignores a URL-only OG author value", () => {
    const html = `
      <meta property="og:type" content="book">
      <meta property="og:title" content="Some Book">
      <meta property="book:author" content="https://example.com/author/42">
      <meta property="book:isbn" content="1234567890">
    `;
    const result = extractBookMetadata(html, "https://example.com/book/1");
    expect(result).not.toBeNull();
    expect(result?.authors).toEqual([]);
  });

  it("returns null for a non-book page", () => {
    const html = `
      <meta property="og:type" content="article">
      <meta property="og:title" content="Blog Post">
    `;
    expect(
      extractBookMetadata(html, "https://blog.example.com/post"),
    ).toBeNull();
  });

  it("returns null for a product page with no book signals", () => {
    const html = `
      <meta property="og:type" content="product">
      <meta property="product:price:amount" content="19.99">
    `;
    expect(
      extractBookMetadata(html, "https://shop.example.com/item"),
    ).toBeNull();
  });

  it("detects a book from a known book URL even without metadata", () => {
    const html = "<title>Some Book Page</title>";
    const result = extractBookMetadata(
      html,
      "https://openlibrary.org/works/OL45804W",
    );
    expect(result).not.toBeNull();
    expect(result?.domain).toBe("openlibrary.org");
  });
});

describe("extractBookMetadata (Amazon)", () => {
  it("detects a print book and parses title, authors, ISBN, and cover", () => {
    const result = extractBookMetadata(
      amazonBookFixture,
      "https://www.amazon.co.uk/dp/1847940323?ref=cm_sw_r_ffobk",
    );
    expect(result).not.toBeNull();
    expect(result?.title).toBe(
      "Switch: How to change things when change is hard",
    );
    expect(result?.authors).toEqual(["Dan Heath", "Chip Heath"]);
    // ISBN-13 from the title wins over the ISBN-10 ASIN
    expect(result?.isbn).toBe("9781847940322");
    expect(result?.domain).toBe("amazon.co.uk");
    // Size modifier stripped from the cover URL
    expect(result?.ogImage).toBe(
      "https://m.media-amazon.com/images/I/61SzLAD7bfL.jpg",
    );
  });

  it("detects a Kindle edition (B0 ASIN) via the Books title marker", () => {
    const result = extractBookMetadata(
      amazonKindleBookFixture,
      "https://www.amazon.co.uk/dp/B005TKD512",
    );
    expect(result).not.toBeNull();
    expect(result?.title).toBe(
      "Switch: How to change things when change is hard",
    );
    expect(result?.authors).toEqual(["Chip Heath", "Dan Heath"]);
    expect(result?.isbn).toBeNull();
    expect(result?.ogImage).toBe(
      "https://m.media-amazon.com/images/I/719JuZrBrIL.jpg",
    );
  });

  it("detects a print book via ISBN-10 ASIN even when the title is unhelpful", () => {
    const result = extractBookMetadata(
      "<title>Robot Check</title>",
      "https://www.amazon.com/dp/0135957052",
    );
    expect(result).not.toBeNull();
    expect(result?.isbn).toBe("0135957052");
  });

  it("accepts an ISBN-10 ASIN with an X check digit", () => {
    const result = extractBookMetadata(
      "<title>Whatever</title>",
      "https://www.amazon.com/gp/product/043942089X",
    );
    expect(result).not.toBeNull();
    expect(result?.isbn).toBe("043942089X");
  });

  it("rejects non-book Amazon products", () => {
    const html =
      "<title>Sony WH-1000XM5 Noise Cancelling Headphones: Amazon.co.uk: Electronics</title>";
    expect(
      extractBookMetadata(html, "https://www.amazon.co.uk/dp/B09XS7JWHH"),
    ).toBeNull();
  });

  it("rejects a numeric ASIN that fails the ISBN-10 checksum", () => {
    expect(
      extractBookMetadata(
        "<title>Whatever</title>",
        "https://www.amazon.com/dp/1234567890",
      ),
    ).toBeNull();
  });

  it("rejects Amazon pages without a product-detail path", () => {
    expect(
      extractBookMetadata(
        amazonBookFixture,
        "https://www.amazon.co.uk/s?k=switch+heath",
      ),
    ).toBeNull();
  });

  it("rejects Books-style titles on non-Amazon hosts", () => {
    const html =
      "<title>Switch: Amazon.co.uk: Heath, Dan: 9781847940322: Books</title>";
    expect(
      extractBookMetadata(html, "https://example.com/dp/1847940323"),
    ).toBeNull();
  });

  it("detects the mobile /gp/aw/d/ URL shape", () => {
    const result = extractBookMetadata(
      "<title>Whatever</title>",
      "https://www.amazon.co.uk/gp/aw/d/1847940323",
    );
    expect(result).not.toBeNull();
    expect(result?.isbn).toBe("1847940323");
  });

  it("does not detect an unresolved amzn.eu short link (needs redirect resolution)", () => {
    expect(
      extractBookMetadata(amazonBookFixture, "https://amzn.eu/d/04gXpZji"),
    ).toBeNull();
  });
});

describe("isValidIsbn10", () => {
  it("accepts valid ISBN-10s", () => {
    expect(isValidIsbn10("1847940323")).toBe(true);
    expect(isValidIsbn10("0135957052")).toBe(true);
  });

  it("accepts an X check digit, case-insensitively", () => {
    expect(isValidIsbn10("043942089X")).toBe(true);
    expect(isValidIsbn10("043942089x")).toBe(true);
  });

  it("rejects a failing checksum", () => {
    expect(isValidIsbn10("1234567890")).toBe(false);
    expect(isValidIsbn10("1847940324")).toBe(false);
  });

  it("rejects malformed values", () => {
    expect(isValidIsbn10("B005TKD512")).toBe(false); // Kindle ASIN
    expect(isValidIsbn10("184794032")).toBe(false); // too short
    expect(isValidIsbn10("18479403233")).toBe(false); // too long
    expect(isValidIsbn10("18479X0323")).toBe(false); // X not in last position
    expect(isValidIsbn10("")).toBe(false);
  });
});

describe("extractAmazonCoverImage", () => {
  it("prefers data-old-hires and strips the size modifier", () => {
    const html =
      '<img id="landingImage" src="https://m.media-amazon.com/images/I/41Sm._SY445_.jpg" data-old-hires="https://m.media-amazon.com/images/I/719JuZrBrIL._SL1500_.jpg"/>';
    expect(extractAmazonCoverImage(html)).toBe(
      "https://m.media-amazon.com/images/I/719JuZrBrIL.jpg",
    );
  });

  it("falls back to the first data-a-dynamic-image URL", () => {
    const html =
      '<img id="landingImage" data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/61SzLAD7bfL._SY342_.jpg&quot;:[342,222]}"/>';
    expect(extractAmazonCoverImage(html)).toBe(
      "https://m.media-amazon.com/images/I/61SzLAD7bfL.jpg",
    );
  });

  it("falls back to src when no richer source exists", () => {
    const html =
      '<img class="cover" id="imgBlkFront" src="https://m.media-amazon.com/images/I/41Sm._SY445_.jpg"/>';
    expect(extractAmazonCoverImage(html)).toBe(
      "https://m.media-amazon.com/images/I/41Sm.jpg",
    );
  });

  it("returns null when the page has no cover image element", () => {
    expect(extractAmazonCoverImage("<img id='other' src='x.jpg'/>")).toBeNull();
  });
});
