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

// --- Product metadata extraction ---

export type ProductMetadata = {
  title: string | null;
  description: string | null;
  domain: string;
  price: string | null;
  currency: string | null;
  brand: string | null;
  availability: string | null;
  imageUrls: string[];
  ogImage: string | null;
};

/**
 * Extracts the og:type value from HTML
 */
export function extractOgType(html: string): string | null {
  return extractMetaContent(html, "og:type");
}

/**
 * schema.org types that positively identify a page as an article. Article is the
 * parent; the rest are the subtypes publishers/CMSs actually emit.
 */
const ARTICLE_JSONLD_TYPES = new Set([
  "Article",
  "NewsArticle",
  "BlogPosting",
  "TechArticle",
  "ScholarlyArticle",
  "Report",
  "AdvertiserContentArticle",
  "SocialMediaPosting",
]);

/**
 * Searches JSON-LD data for a node whose `@type` (string or array) is one of the
 * recognised article types. Descends into arrays, `@graph`, and the page's
 * primary-entity pointers (`mainEntity` / `mainEntityOfPage`), e.g. a WebPage
 * whose `mainEntity` is an Article.
 *
 * Deliberately NOT a blanket recursion over every property: a listing/index page
 * that merely *embeds* articles (an ItemList of BlogPosting, a related-posts
 * widget) must stay a webpage, not be promoted to article by a nested reference.
 */
/**
 * Narrows an untyped JSON-LD value to a plain object (excludes null and arrays)
 * so its fields can be read safely. JSON-LD is scraped from untrusted pages, so
 * every field access must be guarded rather than assumed.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findArticleTypeInJsonLd(data: unknown): string | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findArticleTypeInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(data)) return null;

  const type = data["@type"];
  const types = Array.isArray(type) ? type : [type];
  for (const t of types) {
    if (typeof t === "string" && ARTICLE_JSONLD_TYPES.has(t)) return t;
  }

  for (const key of ["@graph", "mainEntity", "mainEntityOfPage"]) {
    const found = findArticleTypeInJsonLd(data[key]);
    if (found) return found;
  }

  return null;
}

/**
 * Returns the matched article `@type` from JSON-LD structured data, or null.
 */
export function extractJsonLdArticleType(html: string): string | null {
  const scriptRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match = scriptRegex.exec(html);
  while (match !== null) {
    try {
      const data: unknown = JSON.parse(match[1]);
      const found = findArticleTypeInJsonLd(data);
      if (found) return found;
    } catch {
      // Invalid JSON, skip
    }
    match = scriptRegex.exec(html);
  }
  return null;
}

/**
 * True when the page *declares itself* an article via standard publisher
 * metadata: `og:type=article`, an article-typed JSON-LD node, or an
 * `article:published_time` tag. This is the authoritative, length-independent
 * signal — a real article can carry it while extracting few words, and (unlike
 * word count) a link-dense homepage never sets it. Note some CMSs ship an
 * article with `og:type=website` but a `BlogPosting`/published-time signal, so
 * all three are checked independently.
 */
export function hasArticleStructuredData(html: string): boolean {
  if (extractOgType(html)?.toLowerCase() === "article") return true;
  if (extractJsonLdArticleType(html)) return true;
  if (extractMetaContent(html, "article:published_time")) return true;
  return false;
}

/**
 * Extracts product data from JSON-LD structured data.
 * Looks for `@type: "Product"` in script[type="application/ld+json"] blocks.
 */
export function extractJsonLdProduct(html: string): {
  price: string | null;
  currency: string | null;
  brand: string | null;
  availability: string | null;
  images: string[];
} | null {
  const scriptRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match = scriptRegex.exec(html);
  while (match !== null) {
    try {
      const data: unknown = JSON.parse(match[1]);
      const product = findProductInJsonLd(data);
      if (product) {
        const offers = product.offers;
        const offer = Array.isArray(offers) ? offers[0] : offers;
        const offerRec = isRecord(offer) ? offer : null;

        return {
          price:
            jsonLdPriceToString(offerRec?.price) ??
            jsonLdPriceToString(offerRec?.lowPrice) ??
            null,
          currency:
            typeof offerRec?.priceCurrency === "string"
              ? offerRec.priceCurrency
              : null,
          brand: parseJsonLdBrand(product.brand),
          availability: parseAvailability(offerRec?.availability),
          images: parseJsonLdImages(product.image),
        };
      }
    } catch {
      // Invalid JSON, skip
    }
    match = scriptRegex.exec(html);
  }

  return null;
}

/**
 * Recursively searches JSON-LD data for a Product type.
 * Handles @graph arrays and nested structures.
 */
function findProductInJsonLd(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findProductInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(data)) return null;

  if (data["@type"] === "Product") return data;

  if (data["@graph"]) {
    return findProductInJsonLd(data["@graph"]);
  }

  return null;
}

/**
 * Coerces a JSON-LD price value (string or number) to its string form, or null
 * for any other type. Guards against non-primitive price fields in untrusted data.
 */
function jsonLdPriceToString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return null;
}

/**
 * Reads a JSON-LD brand, which may be a plain string or an object with a
 * `name`. Returns null for any other shape.
 */
function parseJsonLdBrand(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.name === "string") return value.name;
  return null;
}

/**
 * Normalizes schema.org availability URLs to short labels. Accepts untrusted
 * JSON-LD values and returns null for anything that isn't a non-empty string.
 */
function parseAvailability(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const short = value.replace(/^https?:\/\/schema\.org\//, "");
  return short || null;
}

/**
 * Collects product image URLs from structured data sources only.
 * Sources: JSON-LD `image` field, multiple `og:image` meta tags.
 * Does NOT scrape arbitrary <img> tags.
 */
export function extractProductImageUrls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (url: string) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };

  // 1. JSON-LD images (highest quality, explicitly product images)
  const jsonLd = extractJsonLdProduct(html);
  if (jsonLd) {
    for (const img of jsonLd.images) {
      addUrl(img);
    }
  }

  // 2. All og:image tags (product pages often have multiple)
  const ogImageRegex =
    /<meta[^>]+(?:property=["']og:image["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']og:image["'])[^>]*>/gi;
  let ogMatch = ogImageRegex.exec(html);
  while (ogMatch !== null) {
    const url = ogMatch[1] || ogMatch[2];
    if (url) addUrl(decodeHtmlEntities(url));
    ogMatch = ogImageRegex.exec(html);
  }

  return urls;
}

export type ProductImageSource = "json-ld" | "og" | "dom";

export type ProductImageCandidate = {
  url: string;
  source: ProductImageSource;
};

const MAX_PRODUCT_IMAGE_CANDIDATES = 50;

// Word-bounded so we don't false-positive on legitimate product names like
// "iconic-chair.jpg", "logos-tee.jpg", or "striped-shirt.jpg".
// The pixel./blank./loading. patterns intentionally match the literal "."
// so they catch tracking/spacer GIFs (pixel.gif etc) without word boundary.
const JUNK_URL_RE =
  /\b(?:sprite|icon|logo|badge|avatar|emoji|favicon|payment|visa|mastercard|paypal|apple-?pay|google-?pay|amex|discover|stripe|placeholder|spacer|tracker|analytics)\b|\bpixel\.|\bblank\.|\bloading\./i;

const SOURCE_PRIORITY: Record<ProductImageSource, number> = {
  "json-ld": 3,
  og: 2,
  dom: 1,
};

function detectWidthHint(url: string): number {
  // ?width=N, ?w=N, ?size=N
  const q = url.match(/[?&](?:width|w|size)=(\d+)/i);
  if (q) return Number.parseInt(q[1], 10);
  // -800x600, _800x600
  const wh = url.match(/(?:-|_)(\d{2,4})x\d{2,4}/i);
  if (wh) return Number.parseInt(wh[1], 10);
  // -1200w, _800w (followed by extension/query/end so we don't match
  // arbitrary words starting with digits)
  const w = url.match(/(?:-|_)(\d{2,4})w(?=[.?&/]|$)/i);
  if (w) return Number.parseInt(w[1], 10);
  return 0;
}

// Strips responsive size suffixes commonly used by image CDNs so all variants
// of the same image collapse to one dedupe key. Covers WxH (-300x300),
// width-only (-1200w), and retina (@2x, @3x) conventions.
const SIZE_SUFFIX_RE =
  /(?:-|_|\.)\d{2,4}x\d{2,4}|(?:-|_)\d{2,4}w(?=[.?&/]|$)|@\dx/gi;

function pathDedupeKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(SIZE_SUFFIX_RE, "");
    return u.origin + path;
  } catch {
    return url;
  }
}

function resolveImageUrl(raw: string, baseUrl: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Collects every plausible product image URL from a page: JSON-LD `image`,
 * `og:image`/`twitter:image`, `<link rel="preload" as="image">`, all `<img>`
 * src/srcset/data-src variants, and `<source srcset>` inside `<picture>`.
 *
 * Filters obvious junk (icons, logos, payment badges, SVG/GIF, data URIs) and
 * dedupes responsive variants of the same image (e.g. Shopify's
 * `?width=300` vs `?width=1200`), keeping the largest variant. Each result
 * carries its source so downstream code can prefer JSON-LD-tagged images
 * when ranking for cover selection. Capped at MAX_PRODUCT_IMAGE_CANDIDATES.
 */
export function extractAllProductImageCandidates(
  html: string,
  url: string,
): ProductImageCandidate[] {
  // Strip HTML comments so commented-out ad/template markup doesn't leak
  // image URLs into the candidate set.
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, "");

  type Entry = {
    url: string;
    source: ProductImageSource;
    width: number;
    order: number;
  };
  const byKey = new Map<string, Entry>();
  let nextOrder = 0;

  const tryAdd = (raw: string | null, source: ProductImageSource) => {
    if (!raw) return;
    const resolved = resolveImageUrl(raw, url);
    if (!resolved) return;
    if (resolved.startsWith("data:")) return;
    if (/\.(svg|gif)(?:\?|#|$)/i.test(resolved)) return;
    if (JUNK_URL_RE.test(resolved)) return;

    const key = pathDedupeKey(resolved);
    const width = detectWidthHint(resolved);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, { url: resolved, source, width, order: nextOrder++ });
      return;
    }

    if (SOURCE_PRIORITY[source] > SOURCE_PRIORITY[existing.source]) {
      existing.source = source;
    }
    if (width > existing.width) {
      existing.url = resolved;
      existing.width = width;
    }
  };

  // 1. JSON-LD images first — these are the canonical product images
  const jsonLd = extractJsonLdProduct(cleaned);
  if (jsonLd) {
    for (const img of jsonLd.images) tryAdd(img, "json-ld");
  }

  // 2. og:image / twitter:image (multiple og:image tags allowed)
  const ogImageRegex =
    /<meta[^>]+(?:property=["']og:image["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']og:image["'])[^>]*>/gi;
  let ogMatch = ogImageRegex.exec(cleaned);
  while (ogMatch !== null) {
    tryAdd(decodeHtmlEntities(ogMatch[1] || ogMatch[2]), "og");
    ogMatch = ogImageRegex.exec(cleaned);
  }
  const twitterImage = extractMetaContent(cleaned, "twitter:image");
  if (twitterImage) tryAdd(twitterImage, "og");

  // 3. <link rel="preload" as="image"> and <link rel="image_src">
  const linkRegex = /<link\b[^>]*>/gi;
  let linkMatch = linkRegex.exec(cleaned);
  while (linkMatch !== null) {
    const tag = linkMatch[0];
    const isPreloadImage =
      /rel=["']preload["']/i.test(tag) && /as=["']image["']/i.test(tag);
    const isImageSrc = /rel=["']image_src["']/i.test(tag);
    if (isPreloadImage || isImageSrc) {
      const href = tag.match(/href=["']([^"']+)["']/i);
      if (href) tryAdd(decodeHtmlEntities(href[1]), "dom");
    }
    linkMatch = linkRegex.exec(cleaned);
  }

  // 4. <img> tags: src, lazy-load attrs, srcset
  const imgRegex = /<img\b[^>]*>/gi;
  let imgMatch = imgRegex.exec(cleaned);
  while (imgMatch !== null) {
    const tag = imgMatch[0];
    for (const attr of ["src", "data-src", "data-lazy-src", "data-original"]) {
      const v = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
      if (v) tryAdd(decodeHtmlEntities(v[1]), "dom");
    }
    for (const attr of ["srcset", "data-srcset"]) {
      const v = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
      if (!v) continue;
      for (const part of v[1].split(",")) {
        const u = part.trim().split(/\s+/)[0];
        if (u) tryAdd(decodeHtmlEntities(u), "dom");
      }
    }
    imgMatch = imgRegex.exec(cleaned);
  }

  // 5. <source srcset> inside <picture>
  const sourceRegex = /<source\b[^>]*>/gi;
  let sourceMatch = sourceRegex.exec(cleaned);
  while (sourceMatch !== null) {
    const v = sourceMatch[0].match(/srcset=["']([^"']+)["']/i);
    if (v) {
      for (const part of v[1].split(",")) {
        const u = part.trim().split(/\s+/)[0];
        if (u) tryAdd(decodeHtmlEntities(u), "dom");
      }
    }
    sourceMatch = sourceRegex.exec(cleaned);
  }

  return [...byKey.values()]
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_PRODUCT_IMAGE_CANDIDATES)
    .map(({ url: u, source }) => ({ url: u, source }));
}

/**
 * Known e-commerce domain + product URL path patterns.
 * Each entry matches ONLY product pages (not search, category, or blog pages).
 */
type ProductUrlPattern = {
  domain: RegExp;
  path: RegExp;
};

const PRODUCT_URL_PATTERNS: ProductUrlPattern[] = [
  // --- US / Global ---
  // Amazon (all TLDs): /dp/ASIN or /gp/product/ASIN
  {
    domain:
      /amazon\.(com|co\.uk|ca|de|fr|es|it|co\.jp|com\.au|in|com\.br|nl|se|pl|sg|com\.mx|ae|sa)$/,
    path: /\/(?:dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/i,
  },
  // eBay (all TLDs): /itm/...
  {
    domain: /ebay\.(com|co\.uk|de|fr|com\.au|ca|it|es)$/,
    path: /\/itm\/(?:[a-zA-Z0-9-]+\/)?\d{9,15}/,
  },
  // Etsy: /listing/ID/slug
  { domain: /etsy\.com$/, path: /\/listing\/\d+\/[a-zA-Z0-9-]+/ },
  // Walmart: /ip/slug/ID
  { domain: /walmart\.com$/, path: /\/ip\/[a-zA-Z0-9-]+\/\d+/ },
  // Target: /p/slug/-/A-ID
  { domain: /target\.com$/, path: /\/p\/[a-zA-Z0-9-]+\/-\/A-\d+/ },
  // Best Buy: /site/slug/ID.p
  { domain: /bestbuy\.com$/, path: /\/site\/[a-zA-Z0-9-]+\/\d+\.p/ },
  // AliExpress: /item/ID.html
  { domain: /aliexpress\.com$/, path: /\/item\/\d+\.html/ },
  // ASOS: /prd/ID
  { domain: /asos\.com$/, path: /\/prd\/\d+/ },
  // Wayfair: /pdp/...
  { domain: /wayfair\.com$/, path: /\/pdp\// },
  // Temu: ...-g-ID.html
  { domain: /temu\.com$/, path: /-g-\d+\.html/ },

  // --- UK ---
  // John Lewis: /p/slug
  { domain: /johnlewis\.com$/, path: /\/p\/[a-zA-Z0-9-]+/ },
  // Argos: /product/ID
  { domain: /argos\.co\.uk$/, path: /\/product\/\d+/ },
  // Currys: /products/slug.html
  { domain: /currys\.co\.uk$/, path: /\/products\/[^/]+\.html/ },
  // M&S: /slug/p/Pcode
  { domain: /marksandspencer\.com$/, path: /\/p\/[Pp]\w+/ },
  // Selfridges: /.../product/...
  { domain: /selfridges\.com$/, path: /\/product\// },
  // Boots: /product/slug
  { domain: /boots\.com$/, path: /\/product\// },
  // Next: /style/stID
  { domain: /next\.co\.uk$/, path: /\/style\/st\d+/ },
  // Screwfix: /p/slug
  { domain: /screwfix\.com$/, path: /\/p\/[a-zA-Z0-9-]+/ },

  // --- Generic e-commerce path patterns ---
  // Shopify stores (myshopify.com subdomains)
  { domain: /\.myshopify\.com$/, path: /\/products\/[a-zA-Z0-9][a-zA-Z0-9-]+/ },
];

/**
 * Generic product path patterns that work across any domain.
 * Lower confidence than domain-specific patterns, used as fallback.
 */
const GENERIC_PRODUCT_PATH_PATTERNS: RegExp[] = [
  // Shopify custom domains: /products/handle
  /^\/products\/[a-zA-Z0-9][a-zA-Z0-9-]+$/,
  // WooCommerce: /product/handle
  /^\/product\/[a-zA-Z0-9][a-zA-Z0-9-]+$/,
];

/**
 * Checks if a URL matches a known e-commerce product page pattern.
 * Returns true only for product pages, not search/category/blog pages.
 */
export function isKnownProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsed.pathname;

    // Check domain-specific patterns (high confidence)
    for (const pattern of PRODUCT_URL_PATTERNS) {
      if (pattern.domain.test(hostname) && pattern.path.test(pathname)) {
        return true;
      }
    }

    // Check generic path patterns (medium confidence)
    for (const pathPattern of GENERIC_PRODUCT_PATH_PATTERNS) {
      if (pathPattern.test(pathname)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts product metadata from HTML. Returns null if the page is not a product.
 *
 * Detection signals (any one is sufficient):
 * 1. og:type is "product", "product.item", or "product.group"
 * 2. JSON-LD with @type: "Product"
 * 3. Product-specific OG meta tags (product:price:amount, product:price:currency)
 * 4. URL matches a known e-commerce product page pattern
 */
export function extractProductMetadata(
  html: string,
  url: string,
): ProductMetadata | null {
  const ogType = extractOgType(html);
  const isOgProduct =
    ogType === "product" ||
    ogType === "product.item" ||
    ogType === "product.group";

  const jsonLd = extractJsonLdProduct(html);

  const ogPrice = extractMetaContent(html, "product:price:amount");
  const ogCurrency = extractMetaContent(html, "product:price:currency");
  const hasProductOgTags = !!(ogPrice || ogCurrency);

  const isKnownProduct = isKnownProductUrl(url);

  if (!isOgProduct && !jsonLd && !hasProductOgTags && !isKnownProduct) {
    return null;
  }

  const ogBrand = extractMetaContent(html, "product:brand");

  const price = jsonLd?.price ?? ogPrice ?? null;
  const structuredCurrency = jsonLd?.currency ?? ogCurrency ?? null;
  let currency: string | null = structuredCurrency;
  if (currency === null && price !== null) {
    currency = inferCurrencyFromPriceContext(html, price);
  }

  return {
    title: extractTitle(html),
    description: extractDescription(html),
    domain: extractDomain(url),
    price,
    currency,
    brand: jsonLd?.brand ?? ogBrand ?? null,
    availability: jsonLd?.availability ?? null,
    imageUrls: extractProductImageUrls(html),
    ogImage: extractOgImage(html),
  };
}

// --- Book metadata extraction ---

export type BookMetadata = {
  title: string | null;
  description: string | null;
  domain: string;
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  publishedAt: Date | null;
  pageCount: number | null;
  ogImage: string | null;
};

// High-confidence book-page URL patterns. Used only as a fallback signal when a
// page lacks structured book metadata; kept tight to avoid false positives on
// search/category pages.
const BOOK_URL_PATTERNS: ReadonlyArray<{ domain: RegExp; path: RegExp }> = [
  { domain: /(^|\.)goodreads\.com$/, path: /^\/book\/show\// },
  { domain: /(^|\.)books\.google\.[a-z.]+$/, path: /^\/books(\/|\?|$)/ },
  { domain: /(^|\.)openlibrary\.org$/, path: /^\/(works|books)\// },
  { domain: /(^|\.)bookshop\.org$/, path: /^\/(p|books)\// },
];

/**
 * Checks if a URL matches a known book-detail page pattern.
 */
export function isKnownBookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsed.pathname;
    for (const { domain, path } of BOOK_URL_PATTERNS) {
      if (domain.test(hostname) && path.test(pathname)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Amazon product-detail path shapes: /dp/ASIN, /gp/product/ASIN, /gp/aw/d/ASIN
const AMAZON_ASIN_PATH =
  /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i;

function isAmazonHost(hostname: string): boolean {
  return /(^|\.)amazon\.[a-z]{2,3}(\.[a-z]{2})?$/.test(hostname);
}

/**
 * ISBN-10 check-digit validation (mod 11; positions weighted 10..2, check
 * character X = 10). Print-book ASINs are the book's ISBN-10, so a valid
 * ISBN-10 ASIN positively identifies an Amazon page as a book.
 */
export function isValidIsbn10(value: string): boolean {
  if (!/^\d{9}[\dX]$/i.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(value[i]);
  const last = value[9].toUpperCase();
  sum += last === "X" ? 10 : Number(last);
  return sum % 11 === 0;
}

// Amazon <title> category markers for book pages across locales
const AMAZON_BOOK_TITLE_MARKERS = new Set([
  "books",
  "bücher",
  "livres",
  "libros",
  "libri",
]);

type AmazonTitleParts = {
  title: string;
  authors: string[];
  isbn: string | null;
};

/**
 * Parses Amazon's structured page <title>. Two observed shapes:
 * - Print:  "Title: Amazon.co.uk: Last, First, Last, First: 9781847940322: Books"
 * - Kindle: "Title eBook : Last, First: Amazon.co.uk: Books"
 * Returns null unless the trailing Books category marker is present.
 */
function parseAmazonTitle(rawTitle: string): AmazonTitleParts | null {
  const segments = rawTitle.split(":").map((s) => s.trim());
  if (segments.length < 3) return null;
  const marker = segments[segments.length - 1].toLowerCase();
  if (!AMAZON_BOOK_TITLE_MARKERS.has(marker)) return null;

  const amazonIdx = segments.findIndex((s) => /^amazon\.[a-z.]+$/i.test(s));
  if (amazonIdx <= 0) return null;

  const isbnSegment = segments.find((s) => /^97[89][\d-]{10,14}$/.test(s));
  const isAuthorSegment = (s: string | undefined) =>
    !!s && s.includes(",") && !/^97[89]/.test(s);

  // Authors sit after the Amazon segment on print pages, before it on Kindle
  let authorSegment: string | null = null;
  let titleEnd = amazonIdx;
  if (isAuthorSegment(segments[amazonIdx + 1])) {
    authorSegment = segments[amazonIdx + 1];
  } else if (isAuthorSegment(segments[amazonIdx - 1])) {
    authorSegment = segments[amazonIdx - 1];
    titleEnd = amazonIdx - 1;
  }
  if (titleEnd < 1) return null;

  const title = segments
    .slice(0, titleEnd)
    .join(": ")
    .replace(/\s+eBook$/i, "");

  return {
    title,
    authors: authorSegment ? parseAmazonAuthors(authorSegment) : [],
    isbn: isbnSegment ? isbnSegment.replace(/-/g, "") : null,
  };
}

// Amazon lists authors as "Last, First" pairs; fold them back to "First Last"
function parseAmazonAuthors(segment: string): string[] {
  const tokens = segment
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length >= 2 && tokens.length % 2 === 0) {
    const authors: string[] = [];
    for (let i = 0; i < tokens.length; i += 2) {
      authors.push(`${tokens[i + 1]} ${tokens[i]}`);
    }
    return authors;
  }
  return tokens.length > 0 ? [segment.trim()] : [];
}

/**
 * Extracts the cover image from an Amazon book page (they expose no
 * og:image). Prefers the hi-res source, then the responsive image set, then
 * the plain src; strips Amazon's `._SY342_`-style size modifier to get the
 * full-size image.
 */
export function extractAmazonCoverImage(html: string): string | null {
  const imgTag = html.match(
    /<img[^>]*id="(?:landingImage|ebooksImgBlkFront|imgBlkFront)"[^>]*>/i,
  )?.[0];
  if (!imgTag) return null;

  const oldHires = imgTag.match(/data-old-hires="([^"]+)"/i)?.[1];
  // data-a-dynamic-image is an entity-encoded JSON map keyed by URL
  const dynamicFirst = imgTag
    .match(/data-a-dynamic-image="([^"]+)"/i)?.[1]
    ?.match(/https:\/\/[^&"]+/)?.[0];
  const src = imgTag.match(/\ssrc="([^"]+)"/i)?.[1];

  const url = oldHires ?? dynamicFirst ?? src;
  if (!url) return null;
  return url.replace(/\._[^./]+_(\.[a-z]{3,4})$/i, "$1");
}

/**
 * Amazon-specific book detection. Amazon pages ship no structured metadata
 * (no og:type, JSON-LD, or book:* tags), so a page is treated as a book when
 * it is a product-detail URL and either the ASIN is a valid ISBN-10 (print
 * books) or the <title> carries Amazon's Books category marker (Kindle
 * editions and 979-prefixed ISBNs, which have no ISBN-10 ASIN).
 */
function extractAmazonBookMetadata(
  html: string,
  url: string,
): BookMetadata | null {
  let hostname: string;
  let pathname: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    pathname = parsed.pathname;
  } catch {
    return null;
  }
  if (!isAmazonHost(hostname)) return null;

  const asin = pathname.match(AMAZON_ASIN_PATH)?.[1];
  if (!asin) return null;

  const rawTitle = extractTitle(html);
  const titleParts = rawTitle ? parseAmazonTitle(rawTitle) : null;
  const asinIsbn = isValidIsbn10(asin) ? asin.toUpperCase() : null;
  if (!asinIsbn && !titleParts) return null;

  return {
    title: titleParts?.title ?? rawTitle,
    description: extractDescription(html),
    domain: extractDomain(url),
    authors: titleParts?.authors ?? [],
    isbn: titleParts?.isbn ?? asinIsbn,
    publisher: null,
    publishedAt: null,
    pageCount: null,
    ogImage: extractAmazonCoverImage(html),
  };
}

function findBookInJsonLd(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findBookInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(data)) return null;

  const type = data["@type"];
  if (type === "Book" || (Array.isArray(type) && type.includes("Book"))) {
    return data;
  }

  if (data["@graph"]) return findBookInJsonLd(data["@graph"]);

  return null;
}

function parseJsonLdNames(value: unknown): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const names: string[] = [];
  for (const entry of list) {
    if (typeof entry === "string") names.push(entry);
    else if (isRecord(entry) && typeof entry.name === "string")
      names.push(entry.name);
  }
  return names.map((n) => n.trim()).filter(Boolean);
}

function parseJsonLdImages(value: unknown): string[] {
  const images: string[] = [];
  if (Array.isArray(value)) {
    for (const img of value) {
      if (typeof img === "string") {
        if (img) images.push(img);
      } else if (isRecord(img) && typeof img.url === "string" && img.url) {
        images.push(img.url);
      }
    }
  } else if (typeof value === "string") {
    if (value) images.push(value);
  } else if (isRecord(value) && typeof value.url === "string" && value.url) {
    images.push(value.url);
  }
  return images;
}

function parsePageCount(value: unknown): number | null {
  // Only coerce primitives — String() on an array/object (e.g. ["300"]) would
  // otherwise smuggle a bogus page count out of untrusted JSON-LD.
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    n = Number.parseInt(value, 10);
  } else {
    return null;
  }
  return Number.isFinite(n) && n > 0 ? n : null;
}

function splitAuthors(value: string): string[] {
  return value
    .split(/,|;|\band\b|&/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extracts book data from JSON-LD structured data.
 * Looks for `@type: "Book"` in script[type="application/ld+json"] blocks.
 */
export function extractJsonLdBook(html: string): {
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  datePublished: string | null;
  pageCount: number | null;
  images: string[];
  description: string | null;
} | null {
  const scriptRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match = scriptRegex.exec(html);
  while (match !== null) {
    try {
      const data: unknown = JSON.parse(match[1]);
      const book = findBookInJsonLd(data);
      if (book) {
        return {
          authors: parseJsonLdNames(book.author),
          isbn: book.isbn ? String(book.isbn) : null,
          publisher: parseJsonLdNames(book.publisher)[0] ?? null,
          datePublished: book.datePublished ? String(book.datePublished) : null,
          pageCount: parsePageCount(book.numberOfPages),
          images: parseJsonLdImages(book.image),
          description:
            typeof book.description === "string" ? book.description : null,
        };
      }
    } catch {
      // Invalid JSON, skip
    }
    match = scriptRegex.exec(html);
  }

  return null;
}

/**
 * Extracts book metadata from HTML. Returns null if the page is not a book.
 *
 * Detection signals (any one is sufficient):
 * 1. og:type is "book" or "books.book" (Facebook/Goodreads)
 * 2. JSON-LD with @type: "Book"
 * 3. Book-specific OG meta tags (book:isbn / books:isbn, book:release_date)
 * 4. URL matches a known book-detail page pattern
 * 5. Amazon product-detail page with an ISBN-10 ASIN or a Books-category
 *    title (Amazon pages expose no structured metadata at all)
 *
 * Book detection runs before product detection so that book pages that also
 * expose product/price metadata (a book is a subset of "product") resolve to book.
 */
export function extractBookMetadata(
  html: string,
  url: string,
): BookMetadata | null {
  const ogType = extractOgType(html);
  const isOgBook = ogType === "book" || ogType === "books.book";

  const jsonLd = extractJsonLdBook(html);

  // The OG book namespace is written as either `book:*` (spec) or `books:*`
  // (Facebook legacy, used by Goodreads).
  const isbnMeta =
    extractMetaContent(html, "book:isbn") ??
    extractMetaContent(html, "books:isbn");
  const releaseDateMeta =
    extractMetaContent(html, "book:release_date") ??
    extractMetaContent(html, "books:release_date");
  const authorMeta =
    extractMetaContent(html, "book:author") ??
    extractMetaContent(html, "books:author");
  const pageCountMeta =
    extractMetaContent(html, "book:page_count") ??
    extractMetaContent(html, "books:page_count");

  const hasBookOgTags = !!(isbnMeta || releaseDateMeta);

  if (!isOgBook && !jsonLd && !hasBookOgTags && !isKnownBookUrl(url)) {
    // Amazon ships none of the structured signals; detect via ASIN/title
    return extractAmazonBookMetadata(html, url);
  }

  // Prefer JSON-LD author names (real names); the OG `book:author` value is
  // often a profile URL, which we skip.
  let authors = jsonLd?.authors ?? [];
  if (authors.length === 0 && authorMeta && !/^https?:\/\//i.test(authorMeta)) {
    authors = splitAuthors(authorMeta);
  }

  return {
    title: extractTitle(html),
    description: jsonLd?.description ?? extractDescription(html),
    domain: extractDomain(url),
    authors,
    isbn: jsonLd?.isbn ?? isbnMeta ?? null,
    publisher: jsonLd?.publisher ?? null,
    publishedAt: parsePublishedDate(jsonLd?.datePublished ?? releaseDateMeta),
    pageCount: jsonLd?.pageCount ?? parsePageCount(pageCountMeta),
    ogImage: extractOgImage(html),
  };
}

const CURRENCY_SYMBOL_MAP: ReadonlyArray<readonly [string, string]> = [
  ["R$", "BRL"],
  ["CA$", "CAD"],
  ["A$", "AUD"],
  ["NZ$", "NZD"],
  ["HK$", "HKD"],
  ["S$", "SGD"],
  ["CHF", "CHF"],
  ["£", "GBP"],
  ["€", "EUR"],
  ["¥", "JPY"],
  ["₩", "KRW"],
  ["₹", "INR"],
  ["$", "USD"],
];

const ISO_CURRENCY_CODES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "INR",
  "BRL",
  "CNY",
  "KRW",
  "NZD",
  "HKD",
  "SGD",
  "MXN",
  "ZAR",
  "PLN",
  "TRY",
  "AED",
  "SAR",
]);

const PRICE_CONTEXT_WINDOW = 50;

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function priceFormatVariants(price: string): string[] {
  const variants = new Set<string>([price]);
  const num = Number.parseFloat(price);
  if (Number.isNaN(num)) return [...variants];

  const decimalPart = price.includes(".") ? price.split(".")[1] : "";

  if (decimalPart) {
    variants.add(price.replace(".", ","));
  }

  if (Math.abs(num) >= 1000) {
    const fixed = num.toFixed(decimalPart.length || 0);
    const [intPart, decPart] = fixed.split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "_");
    if (decPart) {
      variants.add(`${grouped.replace(/_/g, ",")}.${decPart}`);
      variants.add(`${grouped.replace(/_/g, ".")},${decPart}`);
      variants.add(`${grouped.replace(/_/g, " ")},${decPart}`);
    } else {
      variants.add(grouped.replace(/_/g, ","));
      variants.add(grouped.replace(/_/g, "."));
    }
  }
  return [...variants];
}

function hasWordBoundaryBefore(text: string, symbolLength: number): boolean {
  if (text.length === symbolLength) return true;
  const prevChar = text[text.length - symbolLength - 1];
  return !/[A-Za-z]/.test(prevChar);
}

function hasWordBoundaryAfter(text: string, symbolLength: number): boolean {
  if (text.length === symbolLength) return true;
  const nextChar = text[symbolLength];
  return !/[A-Za-z]/.test(nextChar);
}

/**
 * Searches HTML for a currency symbol or ISO 4217 code adjacent to the given
 * price string, and returns the inferred currency code. Returns null if no
 * recognised symbol/code is adjacent to any occurrence.
 *
 * Use as a fallback when structured data (JSON-LD, OG, microdata) provides a
 * price but no currency. Adjacency tolerates HTML tags between the symbol and
 * the price within a ~50-char window.
 *
 * Why: many e-commerce templates (notably Magento/Hyva storefronts) emit the
 * price amount in OG/microdata but render the currency only as a visible glyph
 * (e.g. `<span class="price">£299.99</span>`). Reading the glyph recovers the
 * currency where structured data alone cannot.
 */
export function inferCurrencyFromPriceContext(
  html: string,
  price: string,
): string | null {
  if (!price) return null;

  const decoded = decodeHtmlEntities(html);
  const variants = priceFormatVariants(price);

  for (const variant of variants) {
    const escaped = escapeRegex(variant);
    const pattern = new RegExp(`(?<![\\d.,])${escaped}(?![\\d.,])`, "g");

    let match = pattern.exec(decoded);
    while (match !== null) {
      const idx = match.index;
      const before = stripHtmlTags(
        decoded.slice(Math.max(0, idx - PRICE_CONTEXT_WINDOW), idx),
      ).trimEnd();
      const after = stripHtmlTags(
        decoded.slice(
          idx + variant.length,
          idx + variant.length + PRICE_CONTEXT_WINDOW,
        ),
      ).trimStart();

      for (const [symbol, code] of CURRENCY_SYMBOL_MAP) {
        if (
          before.endsWith(symbol) &&
          hasWordBoundaryBefore(before, symbol.length)
        ) {
          return code;
        }
      }
      for (const [symbol, code] of CURRENCY_SYMBOL_MAP) {
        if (
          after.startsWith(symbol) &&
          hasWordBoundaryAfter(after, symbol.length)
        ) {
          return code;
        }
      }

      const beforeIso = before.match(/(?:^|[^A-Za-z])([A-Za-z]{3})$/);
      if (beforeIso && ISO_CURRENCY_CODES.has(beforeIso[1].toUpperCase())) {
        return beforeIso[1].toUpperCase();
      }
      const afterIso = after.match(/^([A-Za-z]{3})(?:[^A-Za-z]|$)/);
      if (afterIso && ISO_CURRENCY_CODES.has(afterIso[1].toUpperCase())) {
        return afterIso[1].toUpperCase();
      }

      match = pattern.exec(decoded);
    }
  }

  return null;
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
    "&pound;": "£",
    "&euro;": "€",
    "&yen;": "¥",
    "&cent;": "¢",
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

/**
 * Extracts the tweet ID from a Twitter/X URL
 * Supports both twitter.com and x.com URLs
 */
export function extractTweetId(url: string): string | null {
  // Match patterns like:
  // https://twitter.com/user/status/1234567890
  // https://x.com/user/status/1234567890
  // With optional query params
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Extracts the Twitter Article ID from a Twitter/X URL
 * Twitter Articles use a different URL pattern than tweets
 */
export function extractTwitterArticleId(url: string): string | null {
  // Match patterns like:
  // https://twitter.com/i/article/1234567890
  // https://x.com/i/article/1234567890
  const match = url.match(/(?:twitter\.com|x\.com)\/i\/article\/(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Extracts the video ID from a YouTube URL
 * Supports various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - https://www.youtube-nocookie.com/embed/VIDEO_ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

    // Check if it's a YouTube domain
    if (
      hostname !== "youtube.com" &&
      hostname !== "youtu.be" &&
      hostname !== "youtube-nocookie.com"
    ) {
      return null;
    }

    // youtu.be/VIDEO_ID format
    if (hostname === "youtu.be") {
      const videoId = parsed.pathname.slice(1).split(/[?#]/)[0];
      return videoId || null;
    }

    // youtube.com/watch?v=VIDEO_ID format
    const vParam = parsed.searchParams.get("v");
    if (vParam) {
      return vParam;
    }

    // youtube.com/embed/VIDEO_ID, /shorts/VIDEO_ID, /live/VIDEO_ID formats
    const pathMatch = parsed.pathname.match(
      /^\/(embed|shorts|live|v)\/([a-zA-Z0-9_-]+)/,
    );
    if (pathMatch) {
      return pathMatch[2];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts the video ID from a Vimeo URL
 * Supports various URL formats:
 * - https://vimeo.com/VIDEO_ID
 * - https://vimeo.com/VIDEO_ID/HASH (unlisted videos)
 * - https://player.vimeo.com/video/VIDEO_ID
 * - https://vimeo.com/channels/CHANNEL/VIDEO_ID
 * - https://vimeo.com/groups/GROUP/videos/VIDEO_ID
 */
export function extractVimeoVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

    // Check if it's a Vimeo domain
    if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") {
      return null;
    }

    // player.vimeo.com/video/VIDEO_ID format
    if (hostname === "player.vimeo.com") {
      const match = parsed.pathname.match(/^\/video\/(\d+)/);
      return match ? match[1] : null;
    }

    // vimeo.com patterns
    const pathname = parsed.pathname;

    // vimeo.com/channels/CHANNEL/VIDEO_ID
    const channelMatch = pathname.match(/^\/channels\/[^/]+\/(\d+)/);
    if (channelMatch) {
      return channelMatch[1];
    }

    // vimeo.com/groups/GROUP/videos/VIDEO_ID
    const groupMatch = pathname.match(/^\/groups\/[^/]+\/videos\/(\d+)/);
    if (groupMatch) {
      return groupMatch[1];
    }

    // vimeo.com/VIDEO_ID or vimeo.com/VIDEO_ID/HASH (unlisted)
    const directMatch = pathname.match(/^\/(\d+)/);
    if (directMatch) {
      return directMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

export type SocialEmbedResult = {
  html: string;
  tweetIds: string[];
};

/**
 * Finds the matching closing tag for an opening tag, handling nested same-name tags.
 * Returns the index after the closing tag, or -1 if not found.
 */
function findMatchingCloseTag(
  html: string,
  tagName: string,
  startIndex: number,
): number {
  let depth = 1;
  let pos = startIndex;

  const openTagRegex = new RegExp(`<${tagName}[^>]*>`, "gi");
  const closeTagRegex = new RegExp(`</${tagName}>`, "gi");

  while (depth > 0 && pos < html.length) {
    // Find next open or close tag
    openTagRegex.lastIndex = pos;
    closeTagRegex.lastIndex = pos;

    const openMatch = openTagRegex.exec(html);
    const closeMatch = closeTagRegex.exec(html);

    if (!closeMatch) {
      // No more closing tags, can't find match
      return -1;
    }

    // Determine which comes first
    if (openMatch && openMatch.index < closeMatch.index) {
      // Found another opening tag first
      depth++;
      pos = openMatch.index + openMatch[0].length;
    } else {
      // Found a closing tag
      depth--;
      pos = closeMatch.index + closeMatch[0].length;
      if (depth === 0) {
        return pos;
      }
    }
  }

  return -1;
}

/**
 * Preserves social media embeds by replacing them with placeholder elements
 * that survive Readability processing.
 *
 * Detects Twitter/X embeds in two formats:
 * 1. Official embeds: blockquotes with class="twitter-tweet"
 * 2. Custom onclick embeds: elements with onclick="window.open('https://twitter.com/...')"
 *
 * After Turndown converts to markdown, these become text that can be
 * rendered as embedded tweets on the frontend.
 *
 * Returns both the modified HTML and an array of extracted tweet IDs for logging.
 */
export function preserveSocialEmbeds(html: string): SocialEmbedResult {
  const tweetIds: string[] = [];
  let processedHtml = html;

  // 1. Match Twitter/X blockquote embeds (official embeds)
  // These look like: <blockquote class="twitter-tweet" ...>...<a href="https://twitter.com/user/status/123">...</a>...</blockquote>
  const twitterEmbedRegex =
    /<blockquote[^>]*class=["'][^"']*twitter-tweet[^"']*["'][^>]*>[\s\S]*?<\/blockquote>/gi;

  processedHtml = processedHtml.replace(twitterEmbedRegex, (blockquote) => {
    // Find the tweet URL within the blockquote
    // Look for twitter.com or x.com status links
    const urlMatch = blockquote.match(
      /href=["'](https?:\/\/(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+[^"']*)["']/i,
    );

    if (urlMatch) {
      const tweetUrl = urlMatch[1];
      const tweetId = extractTweetId(tweetUrl);

      if (tweetId) {
        tweetIds.push(tweetId);
        return `<p data-embed-type="twitter" data-tweet-id="${tweetId}">[[TWEET:${tweetId}]]</p>`;
      }
    }

    // If we can't extract the tweet URL, leave the blockquote as-is
    return blockquote;
  });

  // 2. Match elements with onclick containing twitter/x.com URLs
  // These look like: <div onclick="window.open('https://twitter.com/user/status/123', '_blank')">...</div>
  const onclickOpenTagRegex =
    /<(\w+)([^>]*onclick=["'][^"']*(?:window\.open\s*\(\s*['"]|location\s*=\s*['"])(https?:\/\/(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+)[^"']*["'][^>]*)>/gi;

  const replacements: Array<{
    start: number;
    end: number;
    tweetId: string;
  }> = [];

  let match = onclickOpenTagRegex.exec(processedHtml);
  while (match !== null) {
    const tagName = match[1];
    const tweetUrl = match[3];
    const tweetId = extractTweetId(tweetUrl);

    if (tweetId && !tweetIds.includes(tweetId)) {
      const openTagEnd = match.index + match[0].length;
      const closeTagEnd = findMatchingCloseTag(
        processedHtml,
        tagName,
        openTagEnd,
      );

      if (closeTagEnd !== -1) {
        tweetIds.push(tweetId);
        replacements.push({
          start: match.index,
          end: closeTagEnd,
          tweetId,
        });
      }
    }
    match = onclickOpenTagRegex.exec(processedHtml);
  }

  // Apply onclick replacements in reverse order to preserve indices
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, tweetId } = replacements[i];
    processedHtml =
      processedHtml.slice(0, start) +
      `<p data-embed-type="twitter" data-tweet-id="${tweetId}">[[TWEET:${tweetId}]]</p>` +
      processedHtml.slice(end);
  }

  return { html: processedHtml, tweetIds };
}
