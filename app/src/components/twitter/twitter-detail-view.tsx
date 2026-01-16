"use client";

import { ExternalLink } from "lucide-react";
import { TwitterIcon } from "@/components/icons/platform-icons";
import { Button } from "@/components/ui/button";
import { DateTime } from "@/components/ui/date-time";
import { parseTweetText } from "@/lib/twitter/parse-tweet-text";
import { getHostname } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import type { TwitterDetails } from "./types";

type TwitterDetailViewProps = {
  twitterDetails: TwitterDetails;
  sourceUrl?: string | null;
  className?: string;
};

/**
 * Full tweet display for the detail dialog.
 * Shows complete tweet content with media, author info, and link to original.
 */
export function TwitterDetailView({
  twitterDetails,
  sourceUrl,
  className,
}: TwitterDetailViewProps) {
  const {
    tweetId,
    authorName,
    authorUsername,
    authorAvatarUrl,
    text,
    postedAt,
    media,
    card,
  } = twitterDetails;

  const tweetUrl =
    sourceUrl ?? `https://x.com/${authorUsername}/status/${tweetId}`;
  const profileUrl = `https://x.com/${authorUsername}`;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center bg-background p-6 md:p-8",
        className,
      )}
    >
      <article className="mx-auto w-full max-w-xl space-y-4">
        {/* Author header */}
        <div className="flex items-start justify-between">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {authorAvatarUrl ? (
              // biome-ignore lint/a11y/useAltText: author avatar
              <img
                src={authorAvatarUrl}
                className="size-12 rounded-full"
                loading="lazy"
              />
            ) : (
              <div className="size-12 rounded-full bg-gray-200 dark:bg-gray-700" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-gray-900 hover:underline dark:text-gray-100">
                {authorName ?? authorUsername}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                @{authorUsername}
              </span>
            </div>
          </a>
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            <TwitterIcon className="size-6 text-gray-400 dark:text-gray-500" />
          </a>
        </div>

        {/* Tweet text */}
        {text && (
          <p className="whitespace-pre-wrap text-lg text-gray-900 dark:text-gray-100">
            {parseTweetText(text)}
          </p>
        )}

        {/* Media */}
        {media && media.length > 0 && (
          <div
            className={cn(
              "grid gap-2 overflow-hidden rounded-xl",
              media.length === 1 && "grid-cols-1",
              media.length === 2 && "grid-cols-2",
              media.length === 3 && "grid-cols-2",
              media.length >= 4 && "grid-cols-2",
            )}
          >
            {media.map((item, index) => (
              <div
                key={`${item.url}-${index}`}
                className={cn(
                  "relative overflow-hidden bg-gray-100 dark:bg-gray-800",
                  media.length === 3 && index === 0 && "row-span-2",
                )}
              >
                {item.type === "video" ? (
                  <video
                    src={item.url}
                    poster={item.posterUrl}
                    controls
                    className="h-full w-full object-cover"
                    playsInline
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  // biome-ignore lint/a11y/useAltText: tweet media
                  <img
                    src={item.url}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Link card */}
        {card && (
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl border border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
          >
            {card.imageUrl && (
              // biome-ignore lint/a11y/useAltText: link card preview
              <img
                src={card.imageUrl}
                className="aspect-video w-full object-cover"
                loading="lazy"
              />
            )}
            <div className="p-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {getHostname(card.url)}
              </p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {card.title}
              </p>
              {card.description && (
                <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                  {card.description}
                </p>
              )}
            </div>
          </a>
        )}

        {/* Posted date and View on X */}
        <div className="flex items-center justify-between pt-4">
          {postedAt ? (
            <DateTime
              date={postedAt}
              className="text-sm text-gray-500 dark:text-gray-400"
            />
          ) : (
            <div />
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              View on X
            </a>
          </Button>
        </div>
      </article>
    </div>
  );
}
