import { describe, expect, it } from "vitest";
import {
  extractArticleMetadata,
  extractAuthor,
  extractDescription,
  extractDomain,
  extractMetaContent,
  extractOgImage,
  extractTitle,
  parsePublishedDate,
} from "./html-metadata";

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
    expect(metadata.publishedAt?.toISOString()).toBe("2024-01-15T10:30:00.000Z");
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
