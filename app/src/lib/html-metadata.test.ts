import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractArticleMetadata,
  extractAuthor,
  extractDescription,
  extractDomain,
  extractMetaContent,
  extractOgImage,
  extractTitle,
  extractTweetId,
  extractTwitterArticleId,
  parsePublishedDate,
  preserveSocialEmbeds,
} from "./html-metadata";

// Load test fixtures
const aaronFrancisFixture = readFileSync(
  join(__dirname, "__fixtures__/aaron-francis-tweet-embed.html"),
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
