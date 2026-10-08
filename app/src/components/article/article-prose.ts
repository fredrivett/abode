/**
 * Typography for the article reader's body. Shared with the reader's loading
 * placeholder so its skeleton lines use the same font, size, line height and
 * paragraph spacing at every breakpoint.
 *
 * The paragraph opening each section (after a captured `<hr>` divider) gets a
 * drop cap. It's our own typography rather than the publisher's — source drop
 * caps are mostly CSS-only and can't be captured — and the article's first
 * paragraph is left plain, since leftover page furniture can sit there.
 *
 * Captions follow their image as a sibling (markdown has no `<figure>`), so the
 * image paragraph's bottom margin is dropped to sit the caption just under it.
 */
export const ARTICLE_PROSE_CLASS = [
  "prose prose-sm md:prose-base lg:prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:font-serif prose-li:font-serif prose-p:font-serif",
  "prose-figcaption:mt-2 prose-figcaption:font-serif prose-figcaption:leading-snug [&_p:has(+figcaption)]:mb-0 [&_p:has(+figcaption)_img]:mb-0",
  "[&_hr+p]:first-letter:float-left [&_hr+p]:first-letter:mt-[0.1em] [&_hr+p]:first-letter:mr-[0.08em] [&_hr+p]:first-letter:text-[3.5em] [&_hr+p]:first-letter:leading-[0.8] [&_hr+p]:first-letter:font-semibold",
].join(" ");
