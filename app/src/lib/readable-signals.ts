/**
 * Readability-derived signals used to tell a long-form *article* apart from a
 * generic *webpage* (homepage, link hub, listing, thin "about" page).
 *
 * These are the structural half of the article classifier; the authoritative
 * half is publisher metadata (see `hasArticleStructuredData`). Extraction is
 * expensive (JSDOM + Readability + Turndown), so callers run it lazily and only
 * when the article/webpage decision is actually reached.
 *
 * Kept free of side effects (no logging/network) so it can be unit-tested
 * against saved HTML fixtures — the same reason `classifyItemKind` is pure.
 */

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { preserveSocialEmbeds } from "./html-metadata";

export type ReadableSignals = {
  /** Article body as markdown, or null when Readability found no content. */
  articleContent: string | null;
  /** Estimated reading time in minutes, or null when there's no content. */
  readingTime: number | null;
  /** Word count of the extracted content. */
  wordCount: number;
  /**
   * Fraction (0..1) of the extracted content's text that sits inside anchors.
   * Low for prose articles (~0), high for link hubs / homepages / listings.
   */
  linkDensity: number;
  /**
   * Word count of the single longest paragraph in the extracted content.
   * A real article has at least one sustained block of prose; homepages and
   * thin pages are made of short fragments even when their total is large.
   */
  longestParagraphWords: number;
  /** Tweet ids found in preserved social embeds (for downstream logging). */
  tweetIds: string[];
  /** How many `[[TWEET:id]]` markers survived the Readability + Turndown pass. */
  preservedTweetCount: number;
  /**
   * Set only when Readability/JSDOM *threw*. Distinguishes a parse failure from
   * a genuine no-content page (both otherwise yield empty signals) so a caller
   * that can log — this module is intentionally side-effect-free — can warn.
   */
  error?: unknown;
};

const EMPTY: ReadableSignals = {
  articleContent: null,
  readingTime: null,
  wordCount: 0,
  linkDensity: 0,
  longestParagraphWords: 0,
  tweetIds: [],
  preservedTweetCount: 0,
};

/**
 * Reveals React/Next.js streaming-SSR content, which is emitted inside
 * `<div hidden>` and swapped in on hydration — Readability skips hidden nodes,
 * so real article bodies would otherwise be missed.
 *
 * Only the *bare* `hidden` boolean attribute is stripped. `hidden="until-found"`
 * (collapsed accordions / "show more" sections) is intentionally left hidden, so
 * author-hidden content isn't surfaced into the article/webpage decision — and
 * the negative lookahead also avoids the malformed `<div="until-found">` the
 * unguarded replace produced.
 */
export function revealStreamingContent(html: string): string {
  // `(?!\s*=)` rejects a valued attribute even with HTML-legal whitespace
  // around the `=` (e.g. `hidden = "until-found"`), matching only bare `hidden`.
  return html.replace(/<div([^>]*)\s+hidden(?!\s*=)([^>]*)>/gi, "<div$1$2>");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Measures link density and longest-paragraph length on the Readability HTML
 * output (before markdown conversion, so the DOM structure is intact).
 */
function measureStructure(contentHtml: string): {
  linkDensity: number;
  longestParagraphWords: number;
} {
  const body = new JSDOM(`<body>${contentHtml}</body>`).window.document.body;

  const totalLen = normalize(body.textContent ?? "").length;
  let linkLen = 0;
  for (const a of Array.from(body.querySelectorAll("a"))) {
    linkLen += normalize(a.textContent ?? "").length;
  }
  const linkDensity = totalLen === 0 ? 0 : linkLen / totalLen;

  let longestParagraphWords = 0;
  for (const p of Array.from(body.querySelectorAll("p"))) {
    longestParagraphWords = Math.max(
      longestParagraphWords,
      countWords(p.textContent ?? ""),
    );
  }

  return { linkDensity, longestParagraphWords };
}

/**
 * Runs the full Readability pipeline and returns the article content plus the
 * structural signals used for article-vs-webpage classification. Returns empty
 * signals (never throws) when the page can't be parsed.
 */
export function extractReadableSignals(
  html: string,
  url: string,
): ReadableSignals {
  try {
    let processedHtml = revealStreamingContent(html);

    // Preserve Twitter/X embeds (blockquotes) as markers before Readability
    // strips their structure; they're converted back to markdown downstream.
    const embedResult = preserveSocialEmbeds(processedHtml);
    processedHtml = embedResult.html;

    const dom = new JSDOM(processedHtml, { url });
    const article = new Readability(dom.window.document).parse();

    if (!article?.content) {
      return { ...EMPTY, tweetIds: embedResult.tweetIds };
    }

    const { linkDensity, longestParagraphWords } = measureStructure(
      article.content,
    );

    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });
    // Preserve inline SVGs (logos, icons, charts) as raw HTML in the markdown.
    // Cast needed because Turndown types only include HTMLElementTagNameMap.
    turndown.keep(["svg"] as unknown as (keyof HTMLElementTagNameMap)[]);
    const articleContent = turndown.turndown(article.content);

    const wordCount = countWords(articleContent);
    const readingTime = wordCount > 0 ? Math.ceil(wordCount / 200) : null;
    const preservedTweetCount = (
      articleContent.match(/\[\[TWEET:\d+\]\]/g) ?? []
    ).length;

    return {
      articleContent,
      readingTime,
      wordCount,
      linkDensity,
      longestParagraphWords,
      tweetIds: embedResult.tweetIds,
      preservedTweetCount,
    };
  } catch (error) {
    return { ...EMPTY, error };
  }
}
