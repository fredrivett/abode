/**
 * Which card an article/webpage grid item should render:
 * - `"cover"` — the cover-image hero (has a cover, it's loaded, not hidden)
 * - `"text"`  — the note-style text card (no cover, or the cover is hidden)
 * - `null`    — neither yet; fall through to the generic image loading state
 *               while a visible cover's preview URL resolves (set in an effect),
 *               so we never flash the text card before the image paints.
 */
export function articleCardMode(params: {
  isArticleOrWebpage: boolean;
  hasCover: boolean;
  previewReady: boolean;
  coverHidden: boolean;
}): "cover" | "text" | null {
  const { isArticleOrWebpage, hasCover, previewReady, coverHidden } = params;
  if (!isArticleOrWebpage) return null;
  if (!hasCover || coverHidden) return "text";
  return previewReady ? "cover" : null;
}
