import { nameToSlug } from "@/lib/slug";
import type { ExportItem } from "./serialize";

type FrontmatterValue = string | number | boolean | string[] | Date | null;

const MAX_SLUG_LENGTH = 60;

/** `YYYY-MM-DD` of a date (UTC) */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * YAML frontmatter block. Values are written as JSON scalars/flow arrays,
 * which are valid YAML 1.2, so any title or tag round-trips without a YAML
 * library or hand-rolled escaping. Empty values are dropped.
 */
export function toFrontmatter(
  fields: Record<string, FrontmatterValue>,
): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    const scalar = value instanceof Date ? value.toISOString() : value;
    lines.push(`${key}: ${JSON.stringify(scalar)}`);
  }
  return `---\n${lines.join("\n")}\n---\n`;
}

/** Title shown for an item that has none of its own */
export function itemDisplayTitle(
  item: Pick<ExportItem, "title" | "twitter" | "sourceUrl">,
): string {
  return (
    item.title?.trim() ||
    item.twitter?.text?.trim().split("\n")[0]?.slice(0, 80) ||
    item.sourceUrl ||
    "Untitled"
  );
}

/**
 * Stable, readable path for an item's Markdown file:
 * `items/<kind>/<added date>-<title slug>-<id prefix>.md`. The id prefix keeps
 * two same-titled items from colliding.
 */
export function markdownPath(item: ExportItem): string {
  const slug = nameToSlug(itemDisplayTitle(item))
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return `items/${item.kind ?? "other"}/${isoDate(item.addedAt)}-${slug}-${item.id.slice(0, 8)}.md`;
}

// Article bodies keep embedded tweets as `[[TWEET:id]]` markers for the app's
// renderer; outside abode a link is the useful form
function resolveTweetMarkers(markdown: string): string {
  return markdown.replace(
    /\[\[TWEET:(\d+)\]\]/g,
    (_, id: string) => `https://x.com/i/status/${id}`,
  );
}

/** The location the app shows: a manual override wins over EXIF, as in rooms */
function effectiveLocation(item: ExportItem) {
  return (
    item.locations.find(({ source }) => source === "manual") ??
    item.locations.find(({ source }) => source === "exif") ??
    item.locations[0] ??
    null
  );
}

function blockquote(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function kindFrontmatter(item: ExportItem): Record<string, FrontmatterValue> {
  const { article, book, twitter, instagram, video, product, image } = item;
  return {
    ...(article && {
      author: article.author,
      published: article.publishedAt,
      read: article.readAt ? true : null,
      read_at: article.readAt,
    }),
    ...(book && {
      authors: book.authors,
      isbn: book.isbn,
      publisher: book.publisher,
      published: book.publishedAt,
      pages: book.pageCount,
      status: book.status,
      // Stored /10 so half-stars work; shown /5 like everywhere else
      rating: book.rating === null ? null : book.rating / 2,
      started: book.startedAt,
      finished: book.finishedAt,
    }),
    ...(twitter && {
      author: `@${twitter.authorUsername}`,
      posted: twitter.postedAt,
    }),
    ...(instagram && {
      author: `@${instagram.authorUsername}`,
      posted: instagram.postedAt,
    }),
    ...(video && {
      platform: video.platform,
      channel: video.channelName,
      duration_seconds: video.duration,
    }),
    ...(product && {
      brand: product.brand,
      price: product.price,
      currency: product.currency,
    }),
    ...(image && { captured: image.captureDate }),
  };
}

const IMAGE_FILE = /\.(jpe?g|png|gif|webp)$/i;
// Chrome around the content, not the content itself — still in files/
const NOT_EMBEDDED = /^(favicon|author-avatar)\./;
// A scan page's colour original: linked, not shown twice alongside the page
const COLOUR_ORIGINAL = /-original\./;

/**
 * The item's own files, relative to its Markdown file (`items/<kind>/x.md`):
 * images embedded, anything else (a PDF, a scan's colour original) linked.
 */
function fileSection(item: ExportItem): string | null {
  const lines = item.files
    .filter(({ name }) => !NOT_EMBEDDED.test(name))
    .map(({ name, path }) =>
      IMAGE_FILE.test(name) && !COLOUR_ORIGINAL.test(name)
        ? `![${name}](../../${path})`
        : `[${name}](../../${path})`,
    );
  return lines.length > 0 ? lines.join("\n\n") : null;
}

function kindBody(item: ExportItem): string[] {
  const sections: string[] = [];
  if (item.note) {
    sections.push(item.note.content);
  } else if (item.description) {
    sections.push(item.description);
  }
  if (item.article?.content) {
    sections.push(resolveTweetMarkers(item.article.content));
  }
  if (item.twitter?.text) sections.push(item.twitter.text);
  if (item.instagram?.caption) sections.push(item.instagram.caption);
  if (item.book?.review) sections.push(`## Review\n\n${item.book.review}`);
  if (item.image?.ocrText) {
    sections.push(`## Text in image\n\n${item.image.ocrText}`);
  }
  for (const page of item.document?.pages ?? []) {
    if (page.ocrText) {
      sections.push(`## Page ${page.position + 1}\n\n${page.ocrText}`);
    }
  }
  return sections;
}

/**
 * One item as a standalone Markdown file: YAML frontmatter (Obsidian-style
 * properties) then a readable body — the note or article text, captured
 * post text, OCR, the user's private notes, and highlights with their notes.
 */
export function itemToMarkdown(
  item: ExportItem,
  roomNames: string[],
): { path: string; content: string } {
  const location = effectiveLocation(item)?.formatted ?? null;
  const frontmatter = toFrontmatter({
    id: item.id,
    kind: item.kind,
    title: item.title,
    source: item.sourceUrl,
    added: item.addedAt,
    tags: item.userTags,
    ai_tags: item.aiTags,
    rooms: roomNames,
    ...kindFrontmatter(item),
    location,
    shared: item.sharedAt ? true : null,
  });

  const files = fileSection(item);
  const sections = [
    `# ${itemDisplayTitle(item)}`,
    ...(files ? [files] : []),
    ...kindBody(item),
  ];
  if (item.notes?.trim()) sections.push(`## Notes\n\n${item.notes.trim()}`);
  if (item.highlights.length > 0) {
    const highlights = item.highlights.map((highlight) =>
      highlight.note?.trim()
        ? `${blockquote(highlight.text)}\n\n${highlight.note.trim()}`
        : blockquote(highlight.text),
    );
    sections.push(`## Highlights\n\n${highlights.join("\n\n---\n\n")}`);
  }

  return {
    path: markdownPath(item),
    content: `${frontmatter}\n${sections.join("\n\n")}\n`,
  };
}
