import { isValidUrl } from "@/lib/url-utils";

const URL_PATTERN = /https?:\/\/\S+/i;

type ShareParam = string | string[] | undefined;

type ShareParams = {
  url?: ShareParam;
  text?: ShareParam;
  title?: ShareParam;
};

function firstValue(param: ShareParam): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/**
 * The first non-empty raw value across url/text/title.
 *
 * Used to show the user what they actually shared when no URL could be parsed
 * — surfacing a malformed/encoded share instead of failing silently.
 */
export function firstSharedValue(params: ShareParams): string | undefined {
  for (const candidate of [params.url, params.text, params.title]) {
    const value = firstValue(candidate)?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Resolves the shared URL from Web Share Target / share-sheet query params.
 *
 * Prefers the explicit `url` param, but some platforms put the URL in `text`
 * (common on Android) or `title` instead — so each candidate is checked both
 * as a bare URL and for a URL embedded in surrounding text.
 */
export function extractSharedUrl(params: ShareParams): string | null {
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
