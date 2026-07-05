"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProxyImageUrl } from "@/lib/image-url";
import type { BookDetails } from "@/lib/types/item";
import { cn } from "@/lib/utils";

type BookDetailViewProps = {
  bookDetails: BookDetails;
  title?: string | null;
  sourceUrl?: string | null;
  coverFileKey?: string | null;
  className?: string;
};

/**
 * Full book display for the detail dialog.
 * Shows the cover, title, authors, and a link to the original page.
 */
export function BookDetailView({
  bookDetails,
  title,
  sourceUrl,
  coverFileKey,
  className,
}: BookDetailViewProps) {
  const { authors, domain } = bookDetails;
  const authorLine = authors.length > 0 ? authors.join(", ") : null;

  return (
    <div
      className={cn(
        "flex min-h-full w-full flex-col items-center justify-center bg-background p-6 md:p-8",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-sm space-y-6">
        {coverFileKey && (
          <div className="mx-auto max-w-[240px] overflow-hidden rounded-xl shadow-lg">
            {/* biome-ignore lint/a11y/useAltText: book cover image */}
            {/* biome-ignore lint/performance/noImgElement: using proxy URL */}
            <img
              src={getProxyImageUrl(coverFileKey, "full")}
              className="w-full object-contain"
              loading="lazy"
            />
          </div>
        )}

        <div className="space-y-1 text-center">
          {title && (
            <h2 className="font-semibold text-gray-900 text-xl dark:text-gray-100">
              {title}
            </h2>
          )}
          {authorLine && (
            <p className="text-gray-500 text-sm dark:text-gray-400">
              {authorLine}
            </p>
          )}
        </div>

        {sourceUrl && (
          <div className="flex items-center justify-center pt-2">
            <Button variant="outline" size="sm" asChild>
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                View on {domain ?? "site"}
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
