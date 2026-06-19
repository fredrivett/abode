import { isValidUrl } from "@/lib/url-utils";

const URL_PATTERN = /https?:\/\/\S+/i;

type ShareParam = string | string[] | undefined;

function firstValue(param: ShareParam): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/**
 * Resolves the shared URL from Web Share Target / share-sheet query params.
 *
 * Prefers the explicit `url` param, but some platforms put the URL in `text`
 * (common on Android) or `title` instead — so each candidate is checked both
 * as a bare URL and for a URL embedded in surrounding text.
 */
export function extractSharedUrl(params: {
  url?: ShareParam;
  text?: ShareParam;
  title?: ShareParam;
}): string | null {
  const candidates = [params.url, params.text, params.title];

  for (const candidate of candidates) {
    const value = firstValue(candidate)?.trim();
    if (!value) continue;

    if (isValidUrl(value)) return value;

    const embedded = value.match(URL_PATTERN)?.[0];
    if (embedded && isValidUrl(embedded)) return embedded;
  }

  return null;
}
