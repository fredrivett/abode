/**
 * Pre-Readability cleanup of a captured page, for the parts of article markup
 * Readability gets wrong:
 *
 * - **Clutter blocks** ("Read More" cards, newsletter/subscribe prompts, promos,
 *   podcast players) that sit inside the article body. Readability's own
 *   unlikely-candidate list misses many of these class names, so they leak
 *   into the reader mid-article.
 * - **Section dividers** drawn as empty/SVG-only elements or asterism
 *   paragraphs (`* * *`, `⁂`). Readability drops them as contentless, so
 *   sections run together; they become `<hr>`.
 * - **Captions** marked up as classed divs rather than `<figcaption>`, which
 *   would otherwise render as ordinary body paragraphs.
 *
 * Matching is on whole class-name segments (`read-more` matches
 * `block read-more` and `read-more__title`, never `already-moreish`), and every
 * removal is guarded: a matched block that holds real prose, a large share of
 * the page's text, the article wrapper or a preserved tweet is left alone. A
 * miss just leaves clutter in (today's behaviour); a false hit would drop real
 * content, so the list stays short and generic — no per-site rules.
 */

/** Class-name segment sequences marking a block as non-article clutter. */
const CLUTTER_NAMES = [
  "read-more",
  "more-stories",
  "related",
  "recommended",
  "recirculation",
  "most-popular",
  "trending",
  "you-may-like",
  "newsletter",
  "subscribe",
  "subscription",
  "signup",
  "sign-up",
  "paywall",
  "promo",
  "sponsor",
  "sponsored",
  "advert",
  "advertisement",
  "ad",
  "ads",
  "share",
  "sharing",
  "podcast",
  "audio-player",
  "outbrain",
  "taboola",
] as const;

const DIVIDER_NAMES = [
  "divider",
  "separator",
  "section-break",
  "dinkus",
  "asterism",
] as const;

const CAPTION_NAMES = ["caption"] as const;

/** A paragraph whose whole text is an ornamental break: `***`, `* * *`, `⁂`… */
const ASTERISM_TEXT = /^(?:[*⁂•·◆◇♦❖§~]\s*){1,5}$/u;

/** A matched block containing a paragraph this long is prose, not clutter. */
const PROSE_PARAGRAPH_WORDS = 60;

/** A matched block holding this share of the page's words is a wrapper. */
const WRAPPER_WORD_SHARE = 0.3;

/** Longer than this and a "caption" is more likely a body block. */
const MAX_CAPTION_WORDS = 60;

const MEDIA_SELECTOR = "img, picture, video, iframe, svg image";

const ARTICLE_ROOT_SELECTOR = "article, main, [itemprop='articleBody']";

/** Whether `el` is, or contains, an element matching `selector`. */
function isOrContains(el: Element, selector: string): boolean {
  return el.matches(selector) || el.querySelector(selector) !== null;
}

export type ArticleCleanupReport = {
  /** Class attribute of each removed clutter block, for tests and logging. */
  removedBlocks: string[];
  /** How many elements were turned into `<hr>` section breaks. */
  dividers: number;
  /** How many classed caption elements were turned into `<figcaption>`. */
  captions: number;
};

function countWords(text: string | null): number {
  return (text ?? "").split(/\s+/).filter(Boolean).length;
}

function segmentsOf(value: string): string[] {
  return value.toLowerCase().split(/[-_]+/).filter(Boolean);
}

/** Whether `segments` contains `nameSegments` as a contiguous run. */
function containsRun(segments: string[], nameSegments: string[]): boolean {
  for (let i = 0; i + nameSegments.length <= segments.length; i++) {
    if (nameSegments.every((seg, j) => segments[i + j] === seg)) return true;
  }
  return false;
}

function classMatches(el: Element, names: readonly string[]): boolean {
  const nameSegments = names.map(segmentsOf);
  return Array.from(el.classList).some((token) => {
    const segments = segmentsOf(token);
    return nameSegments.some((name) => containsRun(segments, name));
  });
}

const PROTECTED_TAGS = new Set(["HTML", "BODY"]);

function isSafeToRemove(el: Element, bodyWords: number): boolean {
  if (PROTECTED_TAGS.has(el.tagName)) return false;
  if (isOrContains(el, ARTICLE_ROOT_SELECTOR)) return false;
  // Preserved tweet embeds are marker paragraphs (see preserveSocialEmbeds)
  if (el.textContent?.includes("[[TWEET:")) return false;
  if (
    bodyWords > 0 &&
    countWords(el.textContent) / bodyWords > WRAPPER_WORD_SHARE
  )
    return false;
  for (const p of Array.from(el.querySelectorAll("p"))) {
    if (countWords(p.textContent) >= PROSE_PARAGRAPH_WORDS) return false;
  }
  return true;
}

function removeClutter(document: Document): string[] {
  const bodyWords = countWords(document.body.textContent);
  const removed: string[] = [];
  for (const el of Array.from(document.body.querySelectorAll("[class]"))) {
    // An ancestor already removed takes its matched descendants with it
    if (!el.isConnected) continue;
    if (!classMatches(el, CLUTTER_NAMES)) continue;
    if (!isSafeToRemove(el, bodyWords)) continue;
    removed.push(el.getAttribute("class") ?? "");
    el.remove();
  }
  return removed;
}

function isContentlessBreak(el: Element): boolean {
  if (isOrContains(el, MEDIA_SELECTOR)) return false;
  const text = el.textContent?.trim() ?? "";
  return text === "" || ASTERISM_TEXT.test(text);
}

function convertDividers(document: Document): number {
  let count = 0;
  const candidates = Array.from(
    document.body.querySelectorAll("[class], [role='separator'], p"),
  );
  for (const el of candidates) {
    if (!el.isConnected || el.tagName === "HR") continue;
    const isDividerish =
      el.getAttribute("role") === "separator" ||
      classMatches(el, DIVIDER_NAMES);
    const isAsterismParagraph =
      el.tagName === "P" && ASTERISM_TEXT.test(el.textContent?.trim() ?? "");
    if (!isDividerish && !isAsterismParagraph) continue;
    if (!isContentlessBreak(el)) continue;
    el.replaceWith(document.createElement("hr"));
    count++;
  }
  return count;
}

function convertCaptions(document: Document): number {
  let count = 0;
  for (const el of Array.from(document.body.querySelectorAll("[class]"))) {
    if (!el.isConnected || el.tagName === "FIGCAPTION") continue;
    if (el.closest("figcaption") || el.querySelector("figcaption")) continue;
    if (!classMatches(el, CAPTION_NAMES)) continue;
    if (isOrContains(el, MEDIA_SELECTOR)) continue;
    const words = countWords(el.textContent);
    if (words === 0 || words > MAX_CAPTION_WORDS) continue;
    const figcaption = document.createElement("figcaption");
    figcaption.append(...Array.from(el.childNodes));
    el.replaceWith(figcaption);
    count++;
  }
  return count;
}

/**
 * Cleans a captured page in place before Readability runs. Order matters:
 * clutter goes first so a divider or caption *inside* a removed block (a
 * subscribe prompt with its own rule line) isn't converted.
 */
export function cleanArticleDocument(document: Document): ArticleCleanupReport {
  const removedBlocks = removeClutter(document);
  const dividers = convertDividers(document);
  const captions = convertCaptions(document);
  return { removedBlocks, dividers, captions };
}

/**
 * Flattens block children (`<p>`, `<div>`) inside each `<figcaption>` so a kept
 * caption is one inline run of text — the reader's paragraph margins would
 * otherwise space a multi-part caption out like body copy.
 */
export function flattenFigcaptions(root: Element): void {
  for (const figcaption of Array.from(root.querySelectorAll("figcaption"))) {
    const blocks = Array.from(figcaption.querySelectorAll("p, div"));
    for (const block of blocks.reverse()) {
      const next = block.nextSibling;
      block.replaceWith(...Array.from(block.childNodes));
      if (next) next.before(" ");
    }
    figcaption.normalize();
  }
}

/** Turndown's rendering of `<hr>`. */
const MARKDOWN_HR = "* * *";

/**
 * Drops section breaks that don't separate anything: leading, trailing and
 * back-to-back `<hr>`s, left where removed clutter or Readability's own
 * pruning used to sit between two dividers.
 */
export function tidySectionBreaks(markdown: string): string {
  const blocks = markdown.split(/\n{2,}/);
  const kept: string[] = [];
  for (const block of blocks) {
    const isBreak = block.trim() === MARKDOWN_HR;
    const previousIsBreak =
      kept.length === 0 || kept[kept.length - 1].trim() === MARKDOWN_HR;
    if (isBreak && previousIsBreak) continue;
    kept.push(block);
  }
  while (kept.length > 0 && kept[kept.length - 1].trim() === MARKDOWN_HR)
    kept.pop();
  return kept.join("\n\n");
}
