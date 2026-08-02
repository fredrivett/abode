/**
 * Alt text for a tweet's attached image. We can't describe the photo itself, so
 * give a concise, honest context label (who posted it) rather than dumping the
 * full tweet body — the body describes the tweet, not the image, and can run to
 * hundreds of characters. Index it when it's one of several images in the tweet
 * so the gallery items aren't announced identically.
 */
export function tweetImageAlt(
  author: { name?: string | null; username?: string | null },
  position?: { index: number; total: number },
): string {
  const by = author.name
    ? ` by ${author.name}`
    : author.username
      ? ` by @${author.username}`
      : "";
  const of =
    position !== undefined && position.total > 1
      ? ` (${position.index + 1} of ${position.total})`
      : "";
  return `Image from tweet${by}${of}`;
}
