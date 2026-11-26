/**
 * Note title derivation.
 *
 * Notes are composed as a single markdown document, but the app treats
 * `Item.title` as a first-class field (shown/edited in the detail header, used
 * for search and display name) — the same as every other item kind.
 *
 * At create time we bridge the two: if the note opens with a markdown heading,
 * that heading becomes the title and is lifted out of the body. This is a
 * one-shot transform, so the title and the body never hold competing copies —
 * afterwards the title is edited independently in the header.
 */

// Generous ceiling for a user-edited title — guards against abuse without
// rejecting any realistic page title. The item PATCH enforces it.
export const MAX_ITEM_TITLE_LENGTH = 1000;

// Longest title we'll derive; headings are short, but a first-line fallback
// could be a whole sentence. Display surfaces line-clamp beyond this anyway.
const MAX_TITLE_LENGTH = 200;

// CommonMark ATX heading: up to 3 leading spaces, 1–6 `#`, a required space,
// the text, and optional trailing `#` (which must be space-separated to count).
const ATX_HEADING = /^ {0,3}#{1,6} +(.+?)(?: +#+)? *$/;

function truncate(value: string): string {
  return value.length > MAX_TITLE_LENGTH
    ? value.slice(0, MAX_TITLE_LENGTH).trimEnd()
    : value;
}

function firstNonEmptyLineIndex(lines: string[]): number {
  return lines.findIndex((line) => line.trim() !== "");
}

/**
 * If `content` opens with a markdown heading, split it into a title and the
 * remaining body. Otherwise the title is null and the content is unchanged.
 */
export function promoteNoteHeading(content: string): {
  title: string | null;
  content: string;
} {
  const lines = content.split("\n");
  const start = firstNonEmptyLineIndex(lines);
  if (start === -1) return { title: null, content };

  const match = lines[start].match(ATX_HEADING);
  if (!match) return { title: null, content };

  const title = truncate(headingText(match[1]));
  // A heading with no text (e.g. "#   ") isn't a title — leave the note intact
  // rather than storing an empty title and discarding the line
  if (!title) return { title: null, content };

  const body = lines.slice(start + 1);
  // Drop blank lines that separated the heading from the body
  while (body.length > 0 && body[0].trim() === "") body.shift();

  return { title, content: body.join("\n").trimEnd() };
}

/**
 * True when note markdown has no real content. The composer always holds a
 * title heading, so an "empty" note serializes to just heading markers and
 * whitespace — strip those before checking. Used to gate draft persistence
 * (both client and server) so a blank composer never stores a draft.
 */
export function isBlankNote(markdown: string): boolean {
  return markdown.replace(/[#\s]/g, "").length === 0;
}

/**
 * Best-effort display name for a note that has no stored title — the first
 * non-empty line with any leading block marker stripped. Used only as a
 * fallback so title-less notes aren't shown as "Untitled"; never stored.
 */
export function noteDisplayName(content: string): string | null {
  const lines = content.split("\n");
  const start = firstNonEmptyLineIndex(lines);
  if (start === -1) return null;

  const stripped = lines[start]
    .trim()
    .replace(/^#{1,6} +/, "") // heading
    .replace(/^[-*+] +/, "") // bullet list
    .replace(/^\d+\. +/, "") // ordered list
    .replace(/^> ?/, "") // blockquote
    .trim();

  return stripped ? truncate(stripped) : null;
}

// Every ASCII punctuation character can be backslash-escaped in CommonMark
const MARKDOWN_PUNCTUATION = /[!-/:-@[-`{-~]/g;
const MARKDOWN_ESCAPE = /\\([!-/:-@[-`{-~])/g;
// The editor writes these characters in text as HTML entities
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * A heading's markdown as plain text: the editor escapes punctuation and
 * writes `&`, `<` and `>` as entities, and a title stores neither
 */
function headingText(markdown: string): string {
  return markdown
    .replace(MARKDOWN_ESCAPE, "$1")
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity])
    .trim();
}

/**
 * A note as the title-first editor shows it: the title as its opening heading,
 * then the body. The title is plain text, so its punctuation is escaped to keep
 * `*` or `[1]` from turning into markup. An untitled note opens with an empty
 * heading, so the editor's first line is still the title.
 */
export function joinNoteTitle({
  title,
  content,
}: {
  title: string | null;
  content: string;
}): string {
  // A heading is one line: a title saved with a line break (through the notes
  // API) shows joined up, rather than its later lines falling into the body
  const text = title?.replace(/\s+/g, " ").trim();
  const heading = text
    ? `# ${text.replace(MARKDOWN_PUNCTUATION, "\\$&")}`
    : "#";
  return content ? `${heading}\n\n${content}` : heading;
}

/**
 * Splits title-first editor markdown back into the title and body that
 * {@link joinNoteTitle} joined. The first line is always the title heading (an
 * empty one serializes as a blank line, meaning no title), so a heading further
 * down stays in the body.
 */
export function splitNoteTitle(markdown: string): {
  title: string | null;
  content: string;
} {
  const [first = "", ...rest] = markdown.split("\n");
  const text = headingText(first.replace(/^ {0,3}#{1,6}(?: +|$)/, ""))
    // Cut, not rejected: an over-long title would fail the whole save, body
    // included, every time until the line was shortened
    .slice(0, MAX_ITEM_TITLE_LENGTH)
    .trimEnd();
  while (rest.length > 0 && rest[0].trim() === "") rest.shift();
  return { title: text || null, content: rest.join("\n").trimEnd() };
}
