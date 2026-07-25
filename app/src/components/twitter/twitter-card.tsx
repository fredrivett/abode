"use client";

import { TwitterIcon } from "@/components/icons/platform-icons";
import { AutoplayVideo } from "@/components/media/autoplay-video";
import { useAutoplayAllowed } from "@/hooks/use-autoplay-allowed";
import { gridCardStyle } from "@/lib/grid-styles";
import { twitterImageSrc } from "@/lib/twitter/image-src";
import { parseTweetText } from "@/lib/twitter/parse-tweet-text";
import { getTwitterVideoSrc } from "@/lib/twitter/video-src";
import { cn } from "@/lib/utils";
import type { TwitterDetails } from "./types";

type TwitterCardProps = {
  twitterDetails: TwitterDetails;
  onClick: () => void;
  className?: string;
};

/**
 * Grid card for displaying a tweet preview.
 * Shows the tweet's media (or an X branding placeholder when there is none).
 * Videos and GIFs autoplay muted while in the viewport, unless the user
 * prefers reduced motion or has data saver enabled.
 */
export function TwitterCard({
  twitterDetails,
  onClick,
  className,
}: TwitterCardProps) {
  const { media, card } = twitterDetails;
  const autoplayAllowed = useAutoplayAllowed();

  // Get preview image: use cover media index, falling back to first item or
  // link card. Prefer our re-hosted copy, falling back to the original twimg URL.
  const coverIndex = twitterDetails.coverMediaIndex ?? 0;
  const coverMedia = media?.[coverIndex] ?? media?.[0];
  const previewImage =
    coverMedia?.type === "photo"
      ? twitterImageSrc(coverMedia.fileKey, coverMedia.url, "grid")
      : (twitterImageSrc(coverMedia?.fileKey, coverMedia?.posterUrl, "grid") ??
        twitterImageSrc(card?.imageFileKey, card?.imageUrl, "grid"));

  const isPlayable =
    coverMedia?.type === "video" || coverMedia?.type === "animated_gif";
  // Lowest bitrate for in-feed autoplay — bandwidth over fidelity
  const videoSrc =
    isPlayable && coverMedia ? getTwitterVideoSrc(coverMedia, "lowest") : null;
  const shouldAutoplay = autoplayAllowed && !!videoSrc;

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
      {shouldAutoplay && videoSrc ? (
        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
          <AutoplayVideo
            src={videoSrc}
            posterUrl={twitterImageSrc(
              coverMedia?.fileKey,
              coverMedia?.posterUrl,
              "grid",
            )}
          />
          {/* GIF badge */}
          {coverMedia?.type === "animated_gif" && (
            <div
              className="absolute rounded bg-black/80 font-medium text-white"
              style={{
                left: "0.5em",
                bottom: "0.5em",
                padding: "0.125em 0.375em",
                fontSize: "0.75em",
              }}
            >
              GIF
            </div>
          )}
        </div>
      ) : previewImage ? (
        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
          {/* biome-ignore lint/a11y/useAltText: decorative preview image */}
          {/* biome-ignore lint/performance/noImgElement: external Twitter image URL */}
          <img
            src={previewImage}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {/* Play indicator for videos/GIFs that aren't autoplaying */}
          {isPlayable && (
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
      ) : twitterDetails.text ? (
        // No media - show the tweet text (with author), clipped with a fade
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden p-4 text-left">
          <div className="flex shrink-0 items-center gap-2">
            {twitterDetails.authorAvatarUrl ? (
              // biome-ignore lint/a11y/useAltText: author avatar
              // biome-ignore lint/performance/noImgElement: external avatar URL
              <img
                src={twitterDetails.authorAvatarUrl}
                className="size-6 shrink-0 rounded-full"
                loading="lazy"
              />
            ) : null}
            <span className="truncate font-semibold text-gray-800 text-sm dark:text-gray-200">
              {twitterDetails.authorName ?? `@${twitterDetails.authorUsername}`}
            </span>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <p className="whitespace-pre-wrap text-gray-900 text-sm leading-snug dark:text-gray-100">
              {parseTweetText(twitterDetails.text)}
            </p>
            {/* Fade out clipped text; invisible over empty card background */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5em] bg-gradient-to-t from-white dark:from-gray-900" />
          </div>
        </div>
      ) : (
        // No media and no text - centered X branding, grows to fill available space
        <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <TwitterIcon className="size-12 text-gray-300 dark:text-gray-600" />
        </div>
      )}

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
