"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { TwitterIcon } from "@/components/icons/platform-icons";
import { Button } from "@/components/ui/button";
import { DateTime } from "@/components/ui/date-time";
import { LoadingEllipsis } from "@/components/ui/loading-ellipsis/loading-ellipsis";
import { twitterImageSrc } from "@/lib/twitter/image-src";
import { parseTweetText } from "@/lib/twitter/parse-tweet-text";
import { getTwitterVideoSrc } from "@/lib/twitter/video-src";
import { getHostname } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import type { TwitterDetails, TwitterMedia } from "./types";

type TwitterDetailViewProps = {
  twitterDetails: TwitterDetails;
  sourceUrl?: string | null;
  className?: string;
  onCoverImageChange?: (index: number) => Promise<void>;
};

/**
 * Full tweet display for the detail dialog.
 * Shows complete tweet content with media, author info, and link to original.
 */
export function TwitterDetailView({
  twitterDetails,
  sourceUrl,
  className,
  onCoverImageChange,
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
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            {authorAvatarUrl ? (
              // biome-ignore lint/a11y/useAltText: author avatar
              // biome-ignore lint/performance/noImgElement: external Twitter avatar URL
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
              <span className="text-gray-500 text-sm dark:text-gray-400">
                @{authorUsername}
              </span>
            </div>
          </a>
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity hover:opacity-80"
          >
            <TwitterIcon className="size-6 text-gray-400 dark:text-gray-500" />
          </a>
        </div>

        {/* Tweet text */}
        {text && (
          <p className="whitespace-pre-wrap text-gray-900 text-lg dark:text-gray-100">
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
            {media.map((item, index) => {
              const isCover = index === (twitterDetails.coverMediaIndex ?? 0);
              return (
                <CoverImageMedia
                  key={`${item.url}-${index}`}
                  item={item}
                  index={index}
                  isCover={isCover}
                  mediaLength={media.length}
                  onCoverImageChange={onCoverImageChange}
                />
              );
            })}
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
              // biome-ignore lint/performance/noImgElement: proxied or external link card URL
              <img
                src={twitterImageSrc(
                  card.imageFileKey,
                  card.imageUrl,
                  "detail",
                )}
                className="aspect-video w-full object-cover"
                loading="lazy"
              />
            )}
            <div className="p-3">
              <p className="text-gray-500 text-sm dark:text-gray-400">
                {getHostname(card.url)}
              </p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {card.title}
              </p>
              {card.description && (
                <p className="line-clamp-2 text-gray-600 text-sm dark:text-gray-300">
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
              className="text-gray-500 text-sm dark:text-gray-400"
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

function CoverImageMedia({
  item,
  index,
  isCover,
  mediaLength,
  onCoverImageChange,
}: {
  item: TwitterMedia;
  index: number;
  isCover: boolean;
  mediaLength: number;
  onCoverImageChange?: (index: number) => Promise<void>;
}) {
  const [isSettingCover, setIsSettingCover] = useState(false);

  const handleSetCover = async () => {
    if (!onCoverImageChange || isCover || isSettingCover) return;
    setIsSettingCover(true);
    try {
      await onCoverImageChange(index);
    } finally {
      setIsSettingCover(false);
    }
  };

  return (
    <div
      className={cn(
        "group/media relative overflow-hidden bg-gray-100 dark:bg-gray-800",
        mediaLength === 3 && index === 0 && "row-span-2",
      )}
    >
      {item.type === "video" || item.type === "animated_gif" ? (
        <video
          src={getTwitterVideoSrc(item, "highest")}
          poster={twitterImageSrc(item.fileKey, item.posterUrl, "detail")}
          controls={item.type === "video"}
          autoPlay={item.type === "animated_gif"}
          loop={item.type === "animated_gif"}
          muted={item.type === "animated_gif"}
          className="h-full w-full object-cover"
          playsInline
        >
          <track kind="captions" />
        </video>
      ) : (
        // biome-ignore lint/a11y/useAltText: tweet media
        // biome-ignore lint/performance/noImgElement: proxied or external Twitter media URL
        <img
          src={twitterImageSrc(item.fileKey, item.url, "detail")}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      )}
      {onCoverImageChange && mediaLength > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSetCover}
          disabled={isCover && !isSettingCover}
          className={cn(
            "absolute top-2 right-2 h-auto px-2 py-1 text-xs transition-opacity",
            "bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 hover:text-white",
            isSettingCover
              ? "opacity-100"
              : isCover
                ? "cursor-default opacity-0 group-hover/media:opacity-70"
                : "opacity-0 group-hover/media:opacity-100",
          )}
        >
          {isSettingCover ? (
            <span>
              Setting as cover
              <LoadingEllipsis />
            </span>
          ) : isCover ? (
            "Cover image"
          ) : (
            "Set as cover"
          )}
        </Button>
      )}
    </div>
  );
}
