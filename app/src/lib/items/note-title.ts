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

  const title = truncate(match[1].trim());
  // A heading with no text (e.g. "#   ") isn't a title — leave the note intact
  // rather than storing an empty title and discarding the line
  if (!title) return { title: null, content };

  const body = lines.slice(start + 1);
  // Drop blank lines that separated the heading from the body
  while (body.length > 0 && body[0].trim() === "") body.shift();

  return { title, content: body.join("\n").trimEnd() };
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
