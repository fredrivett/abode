"use client";

import { TwitterIcon } from "@/components/icons/platform-icons";
import { cn } from "@/lib/utils";
import type { TwitterDetails } from "./types";

type TwitterCardProps = {
  twitterDetails: TwitterDetails;
  onClick: () => void;
  className?: string;
};

/**
 * Grid card for displaying a tweet preview.
 * Shows author info, truncated text, and optional media thumbnail.
 */
export function TwitterCard({
  twitterDetails,
  onClick,
  className,
}: TwitterCardProps) {
  const { authorName, authorUsername, authorAvatarUrl, text, media, card } =
    twitterDetails;

  // Get preview image: first media item or link card image
  const previewImage =
    media?.[0]?.type === "photo"
      ? media[0].url
      : media?.[0]?.posterUrl ?? card?.imageUrl ?? null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700",
        className,
      )}
    >
      {/* Media preview area - grows to fill available space */}
      {previewImage ? (
        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
          {/* biome-ignore lint/a11y/useAltText: decorative preview image */}
          <img
            src={previewImage}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {/* Video indicator */}
          {media?.[0]?.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/60 p-3">
                <svg
                  className="size-6 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      ) : (
        // No media - centered X branding, grows to fill available space
        <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <TwitterIcon className="size-12 text-gray-300 dark:text-gray-600" />
        </div>
      )}

      {/* Content area - fixed size, doesn't grow */}
      <div className="flex shrink-0 flex-col gap-2 p-3">
        {/* Author row */}
        <div className="flex items-center gap-2">
          {authorAvatarUrl ? (
            // biome-ignore lint/a11y/useAltText: decorative avatar
            <img
              src={authorAvatarUrl}
              className="size-5 shrink-0 rounded-full"
              loading="lazy"
            />
          ) : (
            <div className="size-5 shrink-0 rounded-full bg-gray-200 dark:bg-gray-700" />
          )}
          <span className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
            {authorName ?? authorUsername}
          </span>
          <span className="truncate text-xs text-gray-500 dark:text-gray-400">
            @{authorUsername}
          </span>
        </div>

        {/* Tweet text preview */}
        {text && (
          <p className="line-clamp-3 text-left text-sm text-gray-700 dark:text-gray-300">
            {text}
          </p>
        )}
      </div>

      {/* X badge */}
      <div className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 backdrop-blur-sm">
        <TwitterIcon className="size-3 text-white" />
      </div>
    </button>
  );
}
