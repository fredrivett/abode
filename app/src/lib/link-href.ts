/**
 * Helpers for links typed into or stored in user-written markdown (notes).
 *
 * Stored markdown isn't sanitised on parse — a note can hold
 * `[x](javascript:…)` — so anything that opens a link goes through
 * {@link getOpenableHref} first.
 */

const OPENABLE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** The href as an absolute URL that's safe to open, or null (script/relative/malformed) */
export function getOpenableHref(
  href: string | null | undefined,
): string | null {
  if (!href) return null;
  try {
    const url = new URL(href.trim());
    return OPENABLE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Normalises a link typed by the user: bare domains (`example.com/a`) get
 * `https://`. Returns null for anything that wouldn't be openable.
 */
export function normalizeLinkInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (HAS_SCHEME.test(trimmed) && !/^[^:/]+:\d/.test(trimmed)) {
    return getOpenableHref(trimmed) ? trimmed : null;
  }
  const withScheme = `https://${trimmed}`;
  const openable = getOpenableHref(withScheme);
  if (!openable) return null;
  // A bare word ("notes") parses as a hostname — require something domain-like
  const { hostname } = new URL(openable);
  return hostname.includes(".") || hostname === "localhost" ? withScheme : null;
}

/** Compact label for a link: web URLs drop the scheme, `www.` and trailing slash */
export function formatLinkForDisplay(href: string): string {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return href.replace(/^(mailto|tel):/i, "");
    }
    const host = url.host.replace(/^www\./, "");
    const rest = `${url.pathname}${url.search}${url.hash}`;
    return `${host}${rest === "/" ? "" : rest}`;
  } catch {
    return href;
  }
}
