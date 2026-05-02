"use client";

import { TwitterIcon } from "@/components/icons/platform-icons";
import { gridCardStyle } from "@/lib/grid-styles";
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

  // Get preview image: use cover media index, falling back to first item or link card
  const coverIndex = twitterDetails.coverMediaIndex ?? 0;
  const coverMedia = media?.[coverIndex] ?? media?.[0];
  const previewImage =
    coverMedia?.type === "photo"
      ? coverMedia.url
      : (coverMedia?.posterUrl ?? card?.imageUrl ?? null);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700",
        className,
      )}
      style={gridCardStyle}
    >
      {/* Media preview area - grows to fill available space */}
      {previewImage ? (
        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
          {/* biome-ignore lint/a11y/useAltText: decorative preview image */}
          {/* biome-ignore lint/performance/noImgElement: external Twitter image URL */}
          <img
            src={previewImage}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {/* Video indicator */}
          {coverMedia?.type === "video" && (
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

      {/* Content area - on hover-capable devices: overlay that slides up on hover.
          On touch devices: stays in flow below media (current behavior). */}
      <div
        className={cn(
          "flex shrink-0 flex-col bg-white dark:bg-gray-900",
          "[@media(hover:hover)_and_(pointer:fine)]:pointer-events-none",
          "[@media(hover:hover)_and_(pointer:fine)]:absolute",
          "[@media(hover:hover)_and_(pointer:fine)]:inset-x-0",
          "[@media(hover:hover)_and_(pointer:fine)]:bottom-0",
          "[@media(hover:hover)_and_(pointer:fine)]:translate-y-full",
          "[@media(hover:hover)_and_(pointer:fine)]:transition-transform",
          "[@media(hover:hover)_and_(pointer:fine)]:duration-200",
          "[@media(hover:hover)_and_(pointer:fine)]:ease-out",
          "[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-y-0",
        )}
        style={{ padding: "0.75em", gap: "0.5em" }}
      >
        {/* Author row */}
        <div className="flex items-center" style={{ gap: "0.5em" }}>
          {authorAvatarUrl ? (
            // biome-ignore lint/a11y/useAltText: decorative avatar
            // biome-ignore lint/performance/noImgElement: external Twitter avatar URL
            <img
              src={authorAvatarUrl}
              className="shrink-0 rounded-full"
              style={{ width: "1.25em", height: "1.25em" }}
              loading="lazy"
            />
          ) : (
            <div
              className="shrink-0 rounded-full bg-gray-200 dark:bg-gray-700"
              style={{ width: "1.25em", height: "1.25em" }}
            />
          )}
          <span
            className="truncate font-medium text-gray-900 dark:text-gray-100"
            style={{ fontSize: "0.75em" }}
          >
            {authorName ?? authorUsername}
          </span>
          <span
            className="truncate text-gray-500 dark:text-gray-400"
            style={{ fontSize: "0.75em" }}
          >
            @{authorUsername}
          </span>
        </div>

        {/* Tweet text preview */}
        {text && (
          <p
            className="line-clamp-3 text-left text-gray-700 dark:text-gray-300"
            style={{ fontSize: "0.875em" }}
          >
            {text}
          </p>
        )}
      </div>

      {/* X badge */}
      <div
        className="absolute rounded-full bg-black/60 backdrop-blur-sm"
        style={{ top: "0.5em", right: "0.5em", padding: "0.375em" }}
      >
        <TwitterIcon className="h-[0.75em] w-[0.75em] text-white" />
      </div>
    </button>
  );
}
