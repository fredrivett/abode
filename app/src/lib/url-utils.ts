/**
 * URL validation and classification utilities
 */

// Common image extensions
const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".ico",
]);

// Content types that indicate an image
const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "image/x-icon",
]);

/**
 * Checks if a string is a valid HTTP(S) URL
 */
export function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Resolves a post-login redirect target, guarding against open redirects.
 *
 * Only same-origin relative paths are allowed — anything that could escape to
 * another origin (absolute URLs, protocol-relative `//`, backslash tricks)
 * falls back to the default destination.
 */
export function getSafeRedirectPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/**
 * Determines if a URL points to an image based on:
 * 1. Content-Type header (if provided) - this is authoritative when available
 * 2. URL file extension (fallback when no content type)
 */
export function isImageUrl(url: string, contentType?: string | null): boolean {
  // Content type is authoritative when provided
  if (contentType) {
    const mimeType = contentType.split(";")[0].trim().toLowerCase();
    return IMAGE_CONTENT_TYPES.has(mimeType);
  }

  // Fall back to URL extension check when no content type
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    for (const ext of IMAGE_EXTENSIONS) {
      if (pathname.endsWith(ext)) {
        return true;
      }
    }
  } catch {
    // Invalid URL, not an image
  }

  return false;
}

/**
 * Safely extracts the hostname from a URL string.
 * Returns the original string if parsing fails (malformed URL).
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Maps a MIME content type to a file extension (e.g. `"image/png"` → `".png"`).
 *
 * Falls back to `".jpg"` for unrecognised content types.
 *
 * @param contentType - A MIME type string, optionally with parameters (e.g. `"image/png; charset=utf-8"`).
 */
export function getExtensionFromContentType(contentType: string): string {
  const mimeType = contentType.split(";")[0].trim().toLowerCase();
  const extMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico",
  };
  return extMap[mimeType] || ".jpg";
}
