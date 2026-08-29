import type { ReactNode } from "react";
import { getHostname } from "@/lib/url-utils";

// Matches explicit http(s) URLs only — bare domains (e.g. "abode.fyi") stay
// plain text, so the user's own typing decides what links.
const URL_REGEX = /https?:\/\/[^\s]+/g;

// Trailing chars that are almost always sentence punctuation, not part of the
// URL (e.g. "see https://abode.fyi." → link + a plain ".").
const PLAIN_TRAILING = new Set([".", ",", ";", ":", "!", "?", "'", '"']);
// Closing delimiters map to their opener so we only strip an *unmatched* one —
// a balanced pair belongs to the URL (e.g. "…/wiki/Foo_(bar)").
const CLOSING_DELIMITERS: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

/**
 * Splits trailing sentence punctuation off a matched URL. Plain punctuation is
 * always peeled; a closing bracket is peeled only when it has no matching
 * opener within the kept portion, so parenthesized paths stay intact.
 */
function splitTrailingPunctuation(matched: string): {
  url: string;
  trailing: string;
} {
  let end = matched.length;
  while (end > 0) {
    const char = matched[end - 1];
    if (PLAIN_TRAILING.has(char)) {
      end--;
      continue;
    }
    const opener = CLOSING_DELIMITERS[char];
    if (opener) {
      const kept = matched.slice(0, end);
      const closers = kept.split(char).length - 1;
      const openers = kept.split(opener).length - 1;
      if (closers > openers) {
        end--;
        continue;
      }
    }
    break;
  }
  return { url: matched.slice(0, end), trailing: matched.slice(end) };
}

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
    const matchEnd = matchStart + match[0].length;

    // Preceding plain text
    if (matchStart > lastIndex) {
      nodes.push(text.slice(lastIndex, matchStart));
    }

    // Peel trailing punctuation back into the text stream
    const { url, trailing } = splitTrailingPunctuation(match[0]);

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
