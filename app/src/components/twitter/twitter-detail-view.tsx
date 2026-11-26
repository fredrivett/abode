"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { TwitterIcon } from "@/components/icons/platform-icons";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";
import { LoadingEllipsis } from "@/components/ui/loading-ellipsis/loading-ellipsis";
import { PostedDateFooter } from "@/components/ui/posted-date-footer";
import { tweetImageAlt } from "@/lib/twitter/image-alt";
import { twitterImageSrc } from "@/lib/twitter/image-src";
import { parseTweetText } from "@/lib/twitter/parse-tweet-text";
import { getTwitterVideoSrc } from "@/lib/twitter/video-src";
import { isValidUrl } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import { QuotedTweet } from "./quoted-tweet";
import { TweetLinkCard } from "./tweet-link-card";
import { TweetPoll } from "./tweet-poll";
import { TweetReplyContext } from "./tweet-reply-context";
import type { TwitterDetails, TwitterMedia } from "./types";

type TwitterDetailViewProps = {
  twitterDetails: TwitterDetails;
  itemId: string;
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
  itemId,
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
    isTruncated,
    postedAt,
    media,
    card,
    poll,
    quotedTweet,
    inReplyTo,
  } = twitterDetails;

  // Prefer our re-hosted avatar copy, falling back to the original twimg URL
  const authorAvatarSrc = twitterImageSrc(
    twitterDetails.authorAvatarFileKey,
    authorAvatarUrl,
    "thumb",
  );

  const profileUrl = `https://x.com/${authorUsername}`;
  // Only trust a stored sourceUrl if it's a real http(s) URL; otherwise fall
  // back to the derived tweet URL so the link can't navigate somewhere unsafe.
  const tweetUrl =
    sourceUrl && isValidUrl(sourceUrl)
      ? sourceUrl
      : `${profileUrl}/status/${tweetId}`;

  return (
    <div
      className={cn(
        // `@container` + `--pad` let the media carousel bleed out to this box's edges
        "@container flex h-full w-full flex-col items-center justify-center bg-background p-(--pad) [--pad:--spacing(6)] md:[--pad:--spacing(8)]",
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
            {authorAvatarSrc ? (
              // Decorative: the author name renders as visible text alongside
              <Img
                src={authorAvatarSrc}
                alt=""
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

        {inReplyTo && (
          <TweetReplyContext
            inReplyTo={inReplyTo}
            authorUsername={authorUsername}
          />
        )}

        {/* Tweet text — a long-form post is cut off, so link to the rest */}
        {(text || isTruncated) && (
          <p className="whitespace-pre-wrap text-gray-900 text-lg dark:text-gray-100">
            {text && parseTweetText(text)}
            {isTruncated && (
              <>
                {text && "… "}
                <a
                  href={tweetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    posthog.capture("tweet_show_more_clicked", {
                      item_id: itemId,
                    })
                  }
                  className="whitespace-nowrap text-blue-500 hover:underline"
                >
                  Show more on X
                </a>
              </>
            )}
          </p>
        )}

        {/* Media */}
        {media && media.length > 0 && (
          <TweetMedia
            media={media}
            itemId={itemId}
            coverIndex={twitterDetails.coverMediaIndex ?? 0}
            author={{ name: authorName, username: authorUsername }}
            onCoverImageChange={onCoverImageChange}
          />
        )}

        {poll && <TweetPoll poll={poll} />}

        {card && <TweetLinkCard card={card} />}

        {quotedTweet && <QuotedTweet quote={quotedTweet} />}

        {/* Posted date and View on X */}
        <PostedDateFooter
          postedAt={postedAt}
          viewOnHref={tweetUrl}
          viewOnLabel="X"
        />
      </article>
    </div>
  );
}

// Like X: up to 4 media sit in a grid, more scroll sideways in a carousel
const MAX_GRID_MEDIA = 4;

// How far the carousel reaches past the tweet column on each side: from the
// column's edge (max-w-xl, centred) out to the detail view's own edge
const CAROUSEL_BLEED =
  "calc(50cqw + var(--pad) - min(var(--container-xl) / 2, 50cqw))";

// Items past the tweet column fade out towards the view's edges: about a third
// strength halfway out, gone at the edge
const CAROUSEL_FADE = `linear-gradient(to right, transparent, rgb(0 0 0 / 0.35) calc(${CAROUSEL_BLEED} / 2), #000 ${CAROUSEL_BLEED}, #000 calc(100% - ${CAROUSEL_BLEED}), rgb(0 0 0 / 0.35) calc(100% - ${CAROUSEL_BLEED} / 2), transparent)`;

function TweetMedia({
  media,
  itemId,
  coverIndex,
  author,
  onCoverImageChange,
}: {
  media: TwitterMedia[];
  itemId: string;
  coverIndex: number;
  author: { name: string | null; username: string };
  onCoverImageChange?: (index: number) => Promise<void>;
}) {
  const isCarousel = media.length > MAX_GRID_MEDIA;
  const tiles = media.map((item, index) => (
    <CoverImageMedia
      // biome-ignore lint/suspicious/noArrayIndexKey: url can repeat; static, never-reordered list
      key={`${item.url}-${index}`}
      item={item}
      itemId={itemId}
      index={index}
      isCover={index === coverIndex}
      mediaLength={media.length}
      layout={isCarousel ? "carousel" : "grid"}
      imageAlt={tweetImageAlt(author, { index, total: media.length })}
      onCoverImageChange={onCoverImageChange}
    />
  ));

  if (isCarousel) {
    return <MediaCarousel itemId={itemId}>{tiles}</MediaCarousel>;
  }

  return (
    <div
      className={cn(
        "grid gap-2",
        media.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {tiles}
    </div>
  );
}

/**
 * Side-scrolling media row: starts aligned with the tweet, runs out to the
 * edges of the detail view, and snaps each item to the tweet's left edge.
 */
function MediaCarousel({
  itemId,
  children,
}: {
  itemId: string;
  children: React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  const updateCanScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScroll({
      back: el.scrollLeft > 1,
      forward: el.scrollLeft < el.scrollWidth - el.clientWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateCanScroll();
    const observer = new ResizeObserver(updateCanScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateCanScroll]);

  // Scroll to the previous/next item's snap point (its left edge on the tweet's)
  const step = (direction: 1 | -1) => {
    posthog.capture("tweet_media_carousel_navigated", {
      item_id: itemId,
      direction: direction === 1 ? "next" : "previous",
    });
    const el = scrollerRef.current;
    if (!el) return;
    const inset =
      Number.parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
    const origin = el.getBoundingClientRect().left - el.scrollLeft + inset;
    const stops = Array.from(
      el.children,
      (child) => child.getBoundingClientRect().left - origin,
    );
    const target =
      direction === 1
        ? stops.find((stop) => stop > el.scrollLeft + 1)
        : stops.findLast((stop) => stop < el.scrollLeft - 1);
    if (target !== undefined) el.scrollTo({ left: target, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <section
        ref={scrollerRef}
        aria-label="Post media"
        onScroll={updateCanScroll}
        style={{
          marginInline: `calc(-1 * ${CAROUSEL_BLEED})`,
          paddingInline: CAROUSEL_BLEED,
          scrollPaddingInline: CAROUSEL_BLEED,
          maskImage: CAROUSEL_FADE,
        }}
        // py-1.5 leaves room for the cover ring, which overflow would clip
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain py-1.5 [scrollbar-width:none]"
      >
        {children}
      </section>
      <CarouselArrow
        direction="back"
        visible={canScroll.back}
        onClick={() => step(-1)}
      />
      <CarouselArrow
        direction="forward"
        visible={canScroll.forward}
        onClick={() => step(1)}
      />
    </div>
  );
}

function CarouselArrow({
  direction,
  visible,
  onClick,
}: {
  direction: "back" | "forward";
  visible: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "back" ? ChevronLeft : ChevronRight;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={direction === "back" ? "Previous media" : "Next media"}
      onClick={onClick}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        "absolute top-1/2 size-9 -translate-y-1/2 rounded-full transition-opacity",
        "bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 hover:text-white",
        // Inside the tweet column, so they always sit over an image
        direction === "back" ? "left-2" : "right-2",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <Icon />
    </Button>
  );
}

// Carousel items keep their aspect ratio, clamped so a panorama can't fill the
// row and a tall portrait doesn't turn into a sliver
function carouselAspect(item: TwitterMedia) {
  if (!item.width || !item.height) return 1;
  return Math.min(Math.max(item.width / item.height, 3 / 4), 16 / 9);
}

function CoverImageMedia({
  item,
  itemId,
  index,
  isCover,
  mediaLength,
  layout,
  imageAlt,
  onCoverImageChange,
}: {
  item: TwitterMedia;
  itemId: string;
  index: number;
  isCover: boolean;
  mediaLength: number;
  layout: "grid" | "carousel";
  imageAlt: string;
  onCoverImageChange?: (index: number) => Promise<void>;
}) {
  const canChooseCover = !!onCoverImageChange && mediaLength > 1;
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
      style={
        layout === "carousel"
          ? { aspectRatio: carouselAspect(item) }
          : undefined
      }
      className={cn(
        "group/media relative overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800",
        layout === "grid" && mediaLength === 3 && index === 0 && "row-span-2",
        layout === "carousel" && "h-72 shrink-0 snap-start sm:h-96",
        // A ring (box-shadow) rather than a border, so the cover doesn't shift
        canChooseCover &&
          isCover &&
          "ring-3 ring-yellow-500 ring-offset-2 ring-offset-background dark:ring-yellow-400",
      )}
    >
      {item.type === "video" || item.type === "animated_gif" ? (
        <video
          src={getTwitterVideoSrc({ media: item, quality: "highest", itemId })}
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
        <Img
          src={twitterImageSrc(item.fileKey, item.url, "detail")}
          alt={imageAlt}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
      )}
      {canChooseCover && (
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
