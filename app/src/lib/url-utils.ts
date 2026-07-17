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
  next: string | string[] | null | undefined,
  fallback = "/dashboard",
): string {
  // Repeated query params arrive as an array — take the first candidate
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/**
 * Normalizes a user-entered website URL for storage.
 *
 * Trims whitespace and prepends `https://` when no protocol is given (so
 * "example.com" becomes "https://example.com"). Returns the normalized URL, or
 * `null` for empty input or anything that isn't a valid http(s) URL.
 */
export function normalizeWebsiteUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already has an http(s) scheme — validate as-is
  if (/^https?:\/\//i.test(trimmed)) {
    return isValidUrl(trimmed) ? trimmed : null;
  }

  // A scheme prefix that isn't http(s) — e.g. ftp:, mailto:, javascript: — is
  // rejected rather than coerced. The negative lookahead keeps a "host:port"
  // colon (followed by a digit) from being mistaken for a scheme.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(trimmed)) {
    return null;
  }

  const candidate = `https://${trimmed}`;
  return isValidUrl(candidate) ? candidate : null;
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
