import { classifyItemKind } from "@/lib/classify-item-kind";

/** A card aspect ratio expressed as unitless width/height (e.g. 16:9). */
export type AspectHint = { width: number; height: number };

// YouTube/Vimeo thumbnails are always 16:9, matching the grid's video branch.
const VIDEO_ASPECT: AspectHint = { width: 16, height: 9 };

/**
 * Best-effort card aspect for a freshly-saved URL, derived from the URL string
 * alone (no network I/O). Lets the grid render a still-processing URL close to
 * its final shape instead of a generic 4:3, avoiding the masonry re-layout jump
 * when analysis completes.
 *
 * Only videos get a hint: their final aspect (16:9) is reliably known from the
 * URL. Tweets are deliberately excluded — a completed tweet takes its cover
 * media's natural aspect (commonly portrait/square), so any single guess is
 * usually wrong and 4:3 is a safer neutral. Kinds needing the page body
 * (book/product/article/webpage) and direct images (real dimensions only known
 * after download) also return null and keep the 4:3 default.
 */
export function provisionalUrlAspect(url: string): AspectHint | null {
  let resolvedUrl: string;
  try {
    resolvedUrl = new URL(url).href;
  } catch {
    return null;
  }

  const classification = classifyItemKind({
    url,
    resolvedUrl,
    contentType: null,
    html: null,
  });

  return classification?.kind === "video" ? VIDEO_ASPECT : null;
}

/** Narrows a persisted `meta` blob to an aspect hint, if one was stored. */
export function readAspectHint(
  meta: Record<string, unknown> | null | undefined,
): AspectHint | null {
  const hint = meta?.aspectHint;
  if (hint && typeof hint === "object" && "width" in hint && "height" in hint) {
    const { width, height } = hint as { width: unknown; height: unknown };
    if (typeof width === "number" && typeof height === "number") {
      return { width, height };
    }
  }
  return null;
}
