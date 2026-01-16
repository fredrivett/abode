import type { ReactNode } from "react";

/**
 * Parses tweet text and converts URLs to clickable links.
 * Returns an array of ReactNodes - strings for plain text and anchor elements for URLs.
 */
export function parseTweetText(text: string): ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    // Check if this part is a URL
    const isUrl = urlRegex.test(part);
    // Reset regex lastIndex after test (required for global regex)
    urlRegex.lastIndex = 0;

    if (isUrl) {
      return (
        <a
          // biome-ignore lint/suspicious/noArrayIndexKey: Static array from split() never reorders
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
