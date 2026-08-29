import type { ReactNode } from "react";
import { getHostname } from "@/lib/url-utils";

// Matches explicit http(s) URLs only — bare domains (e.g. "abode.fyi") stay
// plain text, so the user's own typing decides what links.
const URL_REGEX = /https?:\/\/[^\s]+/g;

// Trailing characters that are almost always sentence punctuation rather than
// part of the URL (e.g. "see https://abode.fyi." → link + a plain ".").
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

/**
 * Converts explicit http(s) URLs in bio text into clickable links, displayed
 * shortened to their hostname (matching the website pill). Everything else,
 * including bare domains and newlines, is returned untouched as plain text.
 */
export function linkifyBio(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const matchStart = match.index;
    let url = match[0];
    const matchEnd = matchStart + url.length;

    // Preceding plain text
    if (matchStart > lastIndex) {
      nodes.push(text.slice(lastIndex, matchStart));
    }

    // Peel trailing punctuation back into the text stream
    const trailing = url.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    if (trailing) {
      url = url.slice(0, -trailing.length);
    }

    nodes.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
      >
        {getHostname(url)}
      </a>,
    );

    if (trailing) nodes.push(trailing);
    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
