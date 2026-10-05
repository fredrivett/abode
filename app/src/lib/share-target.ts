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
 * What a share that failed to parse looked like, without its contents — for
 * analytics and logs, which must never hold what a user shared.
 */
export function describeSharedValue(params: ShareParams): {
  param: "url" | "text" | "title" | null;
  length: number;
  hasScheme: boolean;
  hasDot: boolean;
  hasWhitespace: boolean;
} {
  for (const param of ["url", "text", "title"] as const) {
    const value = firstValue(params[param])?.trim();
    if (!value) continue;
    return {
      param,
      length: value.length,
      hasScheme: /^[a-z][a-z0-9+.-]*:/i.test(value),
      hasDot: /\w\.\w/.test(value),
      hasWhitespace: /\s/.test(value),
    };
  }
  return {
    param: null,
    length: 0,
    hasScheme: false,
    hasDot: false,
    hasWhitespace: false,
  };
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
