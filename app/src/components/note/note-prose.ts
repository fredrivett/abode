/**
 * Shared typography for rendered note markdown.
 *
 * Used by the grid card preview and the inline composer so typed text matches
 * exactly how it renders on the card once saved. The detail-view editor uses
 * its own larger document scale (see note-editor.tsx).
 */

/**
 * Root font-size for note prose, applied as an inline style (not a class) so
 * it deterministically beats prose-sm's own root size without `!important` —
 * which in turn lets the editor's `max-md:text-[1rem]!` iOS anti-zoom guard
 * win on small screens.
 *
 * The value is driven by `--note-prose-size` so a single prose class serves
 * every surface: contexts set the var to pick a size. The fallback is the grid
 * behaviour — `0.875em` tracks grid density (the card root is
 * `calc(var(--grid-font-scale) * 1rem)`), clamped to a ~12px readability floor.
 * Every prose element is `em`-relative to this root, so the whole scale scales
 * together. The full-screen detail editor sets a comfortable fixed size instead.
 */
export const NOTE_PROSE_FONT_SIZE =
  "var(--note-prose-size, max(0.75rem, 0.875em))";

/**
 * prose-sm's root line-height, shared so non-prose text (e.g. the composer
 * placeholder) aligns with the first line of a paragraph.
 */
export const NOTE_PROSE_LINE_HEIGHT = 1.7142857;

/**
 * Loose-list items wrap their content in a `<p>`, whose top/bottom margins
 * otherwise double the gap between items. Zero the first/last child's outer
 * margins so spacing comes from the list item alone. Shared by the note card /
 * composer prose and the detail-view editor.
 */
export const LOOSE_LIST_MARGIN_FIX =
  "[&_li>*:first-child]:mt-0 [&_li>*:last-child]:mb-0";

const NOTE_PROSE_PARTS = [
  // Base scale and colors
  "prose prose-sm dark:prose-invert max-w-none text-muted-foreground",
  // Headings flattened to near-body size; distinct via weight and color. With
  // sizes flattened they sit on the body rhythm: inherit the root line-height
  // (prose-sm gives headings tighter leading tuned for large display sizes)
  "prose-headings:font-semibold prose-headings:text-[1.05em] prose-headings:text-foreground prose-headings:leading-[inherit]",
  // Tight, even vertical rhythm across block types — prose-sm's defaults are
  // tuned for full articles and read too loose inside a small card
  "prose-p:my-[0.4em]",
  "prose-headings:my-[0.4em]",
  "prose-ul:my-[0.4em] prose-ol:my-[0.4em] prose-li:my-[0.15em]",
  LOOSE_LIST_MARGIN_FIX,
  "prose-blockquote:my-[0.5em]",
  "prose-pre:my-[0.5em]",
  "prose-hr:my-[0.75em]",
  // No dead space at the card edges
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
];

export const NOTE_PROSE_CLASS = NOTE_PROSE_PARTS.join(" ");
