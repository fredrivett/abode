/**
 * Pure item-kind classification.
 *
 * This is the single source of truth for deciding *which kind* a saved URL is.
 * It is intentionally free of network and database side effects: the caller
 * fetches the page (resolving redirects, reading the content-type header, and
 * downloading the HTML body) and passes those artifacts in. That keeps the
 * precedence rules (e.g. book before product) testable against saved fixtures.
 *
 * Not every kind is decided from HTML:
 * - twitter / video are decided from the (resolved) URL
 * - image is decided from the URL + response content-type
 * - book / product / article / webpage are decided from the page HTML
 *
 * Because image/twitter/video can be decided before the HTML body is fetched,
 * the caller may invoke this twice: once with `html: null` (after the HEAD
 * request) and again with the body once it has been downloaded. When `html` is
 * null and no URL/header signal matches, this returns `null` to mean "not enough
 * information yet — fetch the body and try again".
 */

import {
  type ArticleMetadata,
  type BookMetadata,
  extractArticleMetadata,
  extractBookMetadata,
  extractProductMetadata,
  extractTweetId,
  extractTwitterArticleId,
  extractVimeoVideoId,
  extractYouTubeVideoId,
  type ProductMetadata,
} from "./html-metadata";
import type { ForcibleKind } from "./item-kind-reassignment";
import { detectPlatform } from "./platforms";
import { isImageUrl } from "./url-utils";

/** Below this word count a page is treated as a generic webpage, not an article. */
export const MIN_ARTICLE_WORDS = 100;

export type ItemClassification =
  | { kind: "twitter"; tweetId: string; url: string }
  | { kind: "twitterArticle"; articleId: string; url: string }
  | {
      kind: "video";
      platform: "youtube" | "vimeo";
      videoId: string;
      url: string;
    }
  | { kind: "image"; url: string }
  | { kind: "book"; bookMeta: BookMetadata }
  | { kind: "product"; productMeta: ProductMetadata }
  | { kind: "article"; metadata: ArticleMetadata; wordCount: number }
  | { kind: "webpage"; metadata: ArticleMetadata; wordCount: number };

export type ClassifyItemKindInput = {
  /** The original URL as saved by the user (used for platform detection). */
  url: string;
  /** The URL after redirect resolution (e.g. t.co expanded). */
  resolvedUrl: string;
  /** Response content-type header, if known. */
  contentType: string | null;
  /** The fetched page HTML, or null before the body has been downloaded. */
  html: string | null;
  /**
   * Lazily computes the readable article word count (via Readability upstream).
   * Only invoked when reaching the article/webpage decision, so non-article
   * pages never pay for content extraction. Defaults to 0.
   */
  getArticleWordCount?: () => number;
  /**
   * When set, bypass the heuristic and classify the page as this kind (a user
   * manually reassigning the item). Only web-family kinds are forcible, and all
   * are derived from page HTML — so this only takes effect once `html` is
   * present. Structured metadata for the forced kind is extracted best-effort:
   * a page lacking product/book signals still yields a valid (sparse) result.
   */
  forcedKind?: ForcibleKind;
};

/**
 * Build the classification for a user-forced kind from page HTML. Article and
 * webpage always have extractable metadata; product and book fall back to a
 * sparse shape derived from generic page metadata when the page has no
 * structured product/book data (all their extra fields are optional).
 */
function classifyForcedKind(
  forcedKind: ForcibleKind,
  html: string,
  resolvedUrl: string,
  getArticleWordCount?: () => number,
): ItemClassification {
  if (forcedKind === "book") {
    const bookMeta =
      extractBookMetadata(html, resolvedUrl) ??
      sparseBookMetadata(html, resolvedUrl);
    return { kind: "book", bookMeta };
  }

  if (forcedKind === "product") {
    const productMeta =
      extractProductMetadata(html, resolvedUrl) ??
      sparseProductMetadata(html, resolvedUrl);
    return { kind: "product", productMeta };
  }

  // article | webpage — the word-count threshold no longer gates the kind; the
  // user's choice wins. Metadata is always available for a fetched page.
  const metadata = extractArticleMetadata(html, resolvedUrl);
  const wordCount = getArticleWordCount?.() ?? 0;
  return { kind: forcedKind, metadata, wordCount };
}

function sparseBookMetadata(html: string, resolvedUrl: string): BookMetadata {
  const meta = extractArticleMetadata(html, resolvedUrl);
  return {
    title: meta.title,
    description: meta.description,
    domain: meta.domain,
    ogImage: meta.ogImage,
    authors: [],
    isbn: null,
    publisher: null,
    publishedAt: null,
    pageCount: null,
  };
}

function sparseProductMetadata(
  html: string,
  resolvedUrl: string,
): ProductMetadata {
  const meta = extractArticleMetadata(html, resolvedUrl);
  return {
    title: meta.title,
    description: meta.description,
    domain: meta.domain,
    ogImage: meta.ogImage,
    price: null,
    currency: null,
    brand: null,
    availability: null,
    imageUrls: meta.ogImage ? [meta.ogImage] : [],
  };
}

/**
 * Decides the item kind from pre-fetched page artifacts.
 * Returns null when `html` is null and no URL/header signal matches (the caller
 * should fetch the body and call again).
 */
export function classifyItemKind(
  input: ClassifyItemKindInput,
): ItemClassification | null {
  const { url, resolvedUrl, contentType, html, forcedKind } = input;

  // A user-forced kind overrides all heuristics, but every forcible kind is
  // derived from the page body — so wait for the HTML before deciding.
  if (forcedKind) {
    if (html === null) return null;
    return classifyForcedKind(
      forcedKind,
      html,
      resolvedUrl,
      input.getArticleWordCount,
    );
  }

  // Twitter/X posts and articles are decided from the resolved URL. A Twitter
  // URL that is neither a tweet nor an article (e.g. a profile) falls through
  // to the other detectors.
  if (detectPlatform(url) === "twitter") {
    const tweetId = extractTweetId(resolvedUrl);
    if (tweetId) return { kind: "twitter", tweetId, url: resolvedUrl };

    const articleId = extractTwitterArticleId(resolvedUrl);
    if (articleId) {
      return { kind: "twitterArticle", articleId, url: resolvedUrl };
    }
  }

  const youtubeVideoId = extractYouTubeVideoId(resolvedUrl);
  if (youtubeVideoId) {
    return {
      kind: "video",
      platform: "youtube",
      videoId: youtubeVideoId,
      url: resolvedUrl,
    };
  }

  const vimeoVideoId = extractVimeoVideoId(resolvedUrl);
  if (vimeoVideoId) {
    return {
      kind: "video",
      platform: "vimeo",
      videoId: vimeoVideoId,
      url: resolvedUrl,
    };
  }

  if (isImageUrl(resolvedUrl, contentType ?? undefined)) {
    return { kind: "image", url: resolvedUrl };
  }

  // Everything below needs the page body.
  if (html === null) return null;

  // Book before product: a book is a subset of "product", so book signals win.
  const bookMeta = extractBookMetadata(html, resolvedUrl);
  if (bookMeta) return { kind: "book", bookMeta };

  const productMeta = extractProductMetadata(html, resolvedUrl);
  if (productMeta) return { kind: "product", productMeta };

  // Fall back to article vs generic webpage based on readable content length.
  const metadata = extractArticleMetadata(html, resolvedUrl);
  const wordCount = input.getArticleWordCount?.() ?? 0;
  const kind = wordCount >= MIN_ARTICLE_WORDS ? "article" : "webpage";
  return { kind, metadata, wordCount };
}
