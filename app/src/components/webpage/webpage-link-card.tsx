"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getHostname, isValidUrl } from "@/lib/url-utils";
import { cn } from "@/lib/utils";

type WebpageLinkCardProps = {
  /** The page URL — used for the domain label and the "open" affordance */
  url: string;
  title?: string | null;
  description?: string | null;
  /**
   * Proxied URL of the site's re-hosted favicon. When present (and it loads),
   * it renders on the tile in place of the monogram; on load error we fall back
   * to the monogram.
   */
  faviconUrl?: string | null;
  className?: string;
};

/** Strip a leading www. so the domain reads as the brand ("abode.fyi") */
function getDisplayDomain(url: string): string {
  return getHostname(url).replace(/^www\./, "");
}

/** First alphanumeric of the domain, uppercased — the monogram glyph */
export function getMonogram(domain: string): string {
  const match = domain.match(/[a-z0-9]/i);
  return (match?.[0] ?? "?").toUpperCase();
}

/**
 * Deterministic tile colour keyed off the domain, so a given site always gets
 * the same monogram colour. Mid-lightness + white text reads in light and dark.
 */
export function getMonogramColor(domain: string): string {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash << 5) - hash + domain.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 42%)`;
}

/**
 * Fallback preview for a webpage/article item that has no cover image.
 *
 * Renders a designed "bookmark" card — an icon tile (the site's favicon, or a
 * domain monogram when there's none), the page title and description, and a
 * domain-labelled button that opens the source — instead of a bare document
 * icon.
 */
export function WebpageLinkCard({
  url,
  title,
  description,
  faviconUrl,
  className,
}: WebpageLinkCardProps) {
  const domain = getDisplayDomain(url);
  const monogram = getMonogram(domain);
  // sourceUrl is untrusted stored data — never render a non-http(s) scheme
  // (e.g. javascript:) as a navigable link
  const safeToOpen = isValidUrl(url);
  // Track which URL failed (not just a boolean) so a reprocessed item with a
  // new favicon isn't stuck on the monogram from a prior load error
  const [failedFaviconUrl, setFailedFaviconUrl] = useState<string | null>(null);
  const showFavicon = Boolean(faviconUrl) && faviconUrl !== failedFaviconUrl;

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-lg border border-border bg-muted/30 p-8 text-center text-foreground",
        className,
      )}
    >
      <div
        className="flex size-20 items-center justify-center rounded-2xl shadow-sm"
        style={
          showFavicon
            ? undefined
            : { backgroundColor: getMonogramColor(domain) }
        }
      >
        {showFavicon && faviconUrl ? (
          // biome-ignore lint/performance/noImgElement: proxy URL for user-uploaded content
          <img
            src={faviconUrl}
            alt=""
            className="size-11 rounded-md object-contain"
            onError={() => setFailedFaviconUrl(faviconUrl ?? null)}
          />
        ) : (
          <span className="font-semibold font-serif text-3xl text-white">
            {monogram}
          </span>
        )}
      </div>
      {title && (
        <p className="line-clamp-3 font-semibold font-serif text-foreground text-xl">
          {title}
        </p>
      )}
      {description && (
        <p className="line-clamp-3 text-muted-foreground text-sm">
          {description}
        </p>
      )}
      {safeToOpen ? (
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            {domain}
            <ExternalLink />
          </a>
        </Button>
      ) : (
        <span className="text-muted-foreground text-sm">{domain}</span>
      )}
    </div>
  );
}
