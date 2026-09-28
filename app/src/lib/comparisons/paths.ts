// Kept apart from the comparison data so client code (the footer, shipped on
// every page) can link here without bundling every competitor's facts

/** URL of the comparisons hub, or of one comparison page */
export function comparePath(slug?: string): string {
  return slug ? `/compare/${slug}` : "/compare";
}
