/**
 * HTML metadata extraction utilities for articles/web pages
 */

export type ArticleMetadata = {
  title: string | null;
  description: string | null;
  author: string | null;
  domain: string;
  publishedAt: Date | null;
  ogImage: string | null;
};

/**
 * Extracts the content attribute value from a meta tag by property or name
 * Handles both attribute orderings: property/name before content and content before property/name
 */
export function extractMetaContent(html: string, name: string): string | null {
  // Try property (Open Graph) - property before content
  const ogMatch = html.match(
    new RegExp(
      `<meta[^>]+property=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
  );
  if (ogMatch) return decodeHtmlEntities(ogMatch[1]);

  // Try name (standard meta) - name before content
  const nameMatch = html.match(
    new RegExp(
      `<meta[^>]+name=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
  );
  if (nameMatch) return decodeHtmlEntities(nameMatch[1]);

  // Try reversed attribute order - content before property
  const reversedOg = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(name)}["']`,
      "i",
    ),
  );
  if (reversedOg) return decodeHtmlEntities(reversedOg[1]);

  // Try reversed attribute order - content before name
  const reversedName = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegex(name)}["']`,
      "i",
    ),
  );
  if (reversedName) return decodeHtmlEntities(reversedName[1]);

  return null;
}

/**
 * Extracts the page title from HTML, trying multiple sources
 */
export function extractTitle(html: string): string | null {
  // Try Open Graph title first (usually more descriptive)
  const ogTitle = extractMetaContent(html, "og:title");
  if (ogTitle) return ogTitle;

  // Try Twitter title
  const twitterTitle = extractMetaContent(html, "twitter:title");
  if (twitterTitle) return twitterTitle;

  // Fall back to <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return decodeHtmlEntities(titleMatch[1].trim());

  return null;
}

/**
 * Extracts the page description from HTML
 */
export function extractDescription(html: string): string | null {
  return (
    extractMetaContent(html, "og:description") ||
    extractMetaContent(html, "description") ||
    extractMetaContent(html, "twitter:description")
  );
}

/**
 * Extracts the author from HTML
 */
export function extractAuthor(html: string): string | null {
  return (
    extractMetaContent(html, "author") ||
    extractMetaContent(html, "article:author")
  );
}

/**
 * Extracts the Open Graph or Twitter card image URL
 */
export function extractOgImage(html: string): string | null {
  return (
    extractMetaContent(html, "og:image") ||
    extractMetaContent(html, "twitter:image")
  );
}

/**
 * Parses a date string into a Date object, returns null if invalid
 */
export function parsePublishedDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Extracts the domain from a URL, removing www. prefix
 */
export function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Extracts all article metadata from HTML in a single pass
 */
export function extractArticleMetadata(
  html: string,
  url: string,
): ArticleMetadata {
  const publishedTimeStr =
    extractMetaContent(html, "article:published_time") ||
    extractMetaContent(html, "datePublished");

  return {
    title: extractTitle(html),
    description: extractDescription(html),
    author: extractAuthor(html),
    domain: extractDomain(url),
    publishedAt: parsePublishedDate(publishedTimeStr),
    ogImage: extractOgImage(html),
  };
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Decodes HTML entities including named, decimal, and hex entities
 */
export function decodeHtmlEntities(str: string): string {
  const namedEntities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };

  return str.replace(/&[a-z0-9#]+;/gi, (match) => {
    // Check named entities first
    if (namedEntities[match]) {
      return namedEntities[match];
    }

    // Handle decimal numeric entities (&#123;)
    const decimalMatch = match.match(/^&#(\d+);$/);
    if (decimalMatch) {
      return String.fromCharCode(Number.parseInt(decimalMatch[1], 10));
    }

    // Handle hex numeric entities (&#x7B; or &#X7B;)
    const hexMatch = match.match(/^&#x([0-9a-f]+);$/i);
    if (hexMatch) {
      return String.fromCharCode(Number.parseInt(hexMatch[1], 16));
    }

    return match;
  });
}
