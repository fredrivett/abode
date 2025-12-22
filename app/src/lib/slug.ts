/**
 * Convert a name/title to a URL-safe slug.
 *
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes leading/trailing hyphens
 * - Collapses multiple consecutive hyphens
 * - Returns "untitled" if the result is empty
 */
export function nameToSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

  return slug || "untitled";
}
