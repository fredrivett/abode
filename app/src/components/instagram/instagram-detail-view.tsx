"use client";

import { ExternalLink } from "lucide-react";
import { InstagramIcon } from "@/components/icons/platform-icons";
import { Button } from "@/components/ui/button";
import { DateTime } from "@/components/ui/date-time";
import { instagramImageSrc } from "@/lib/instagram/image-src";
import { cn } from "@/lib/utils";
import type { InstagramDetails } from "./types";

type InstagramDetailViewProps = {
  instagramDetails: InstagramDetails;
  sourceUrl?: string | null;
  className?: string;
};

/**
 * Full Instagram post display for the detail dialog. A URL-paste capture is a
 * single cover image; the extension can later enrich it to the full carousel.
 */
export function InstagramDetailView({
  instagramDetails,
  sourceUrl,
  className,
}: InstagramDetailViewProps) {
  const {
    postId,
    authorName,
    authorUsername,
    caption,
    postedAt,
    media,
    likeCount,
    commentCount,
  } = instagramDetails;

  const postUrl = sourceUrl ?? `https://www.instagram.com/p/${postId}/`;
  const profileUrl = `https://www.instagram.com/${authorUsername}/`;

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
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity hover:opacity-80"
          >
            <InstagramIcon className="size-6 text-gray-400 dark:text-gray-500" />
          </a>
        </div>

        {/* Media */}
        {media && media.length > 0 && (
          <div className="grid grid-cols-1 gap-2 overflow-hidden rounded-xl">
            {media.map((item, index) => (
              <div
                key={`${item.url}-${index}`}
                className="relative overflow-hidden bg-gray-100 dark:bg-gray-800"
              >
                {/* biome-ignore lint/performance/noImgElement: proxied or external Instagram media URL */}
                <img
                  src={instagramImageSrc(item.fileKey, item.url, "detail")}
                  alt={`Instagram post by @${authorUsername}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Caption */}
        {caption && (
          <p className="whitespace-pre-wrap text-gray-900 text-lg dark:text-gray-100">
            {caption}
          </p>
        )}

        {/* Like / comment counts */}
        {(likeCount != null || commentCount != null) && (
          <div className="flex gap-4 text-gray-500 text-sm dark:text-gray-400">
            {likeCount != null && (
              <span>
                {likeCount.toLocaleString()}{" "}
                {likeCount === 1 ? "like" : "likes"}
              </span>
            )}
            {commentCount != null && (
              <span>
                {commentCount.toLocaleString()}{" "}
                {commentCount === 1 ? "comment" : "comments"}
              </span>
            )}
          </div>
        )}

        {/* Posted date and View on Instagram */}
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
            <a href={postUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              View on Instagram
            </a>
          </Button>
        </div>
      </article>
    </div>
  );
}
