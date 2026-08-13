"use client";

import type { ProcessingStatus } from "@prisma/client";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ArticleCard } from "@/components/article/article-card";
import { BookCover3D } from "@/components/book/book-cover-3d";
import { InstagramCard } from "@/components/instagram/instagram-card";
import type { InstagramDetails } from "@/components/instagram/types";
import { NoteCard } from "@/components/note/note-card";
import { TwitterCard } from "@/components/twitter/twitter-card";
import type { TwitterDetails } from "@/components/twitter/types";
import { VideoCard } from "@/components/video/video-card";
import { BOOK_TILE_PADDING_X, BOOK_TILE_PADDING_Y } from "@/lib/book-cover";
import { gridCardStyle } from "@/lib/grid-styles";
import type { VideoDetails } from "@/lib/types/item";
import { ProcessingOverlay } from "./processing-overlay";

/**
 * How each item kind looks as it loads in. The card renders its real content as
 * soon as its detail row lands (mid-processing) with the `ProcessingOverlay`'s
 * "Analyzing" pill on top; the pill disappears once the item is `completed`.
 *
 * The very first "classifying" frame of a URL paste (a generic link
 * placeholder) is owned by `ItemCard`, not the card components, so it isn't
 * shown here — these stories cover the detail-present → completed transition
 * that the cards themselves render.
 */

const noop = () => {};

// A tweet with a cover image — the card shows the photo (text lives in the
// detail view, not the grid card).
const twitterPhoto: TwitterDetails = {
  tweetId: "896523232098078720",
  authorName: "Barack Obama",
  authorUsername: "BarackObama",
  authorAvatarUrl:
    "https://pbs.twimg.com/profile_images/1329647526807543809/2SGvnHYV_normal.jpg",
  text: '"No one is born hating another person because of the color of his skin or his background or his religion..."',
  postedAt: "2017-08-13T00:06:09.000Z",
  media: [
    {
      type: "photo",
      url: "https://pbs.twimg.com/media/DHEXH7RV0AAUwKj.jpg",
      width: 1200,
      height: 800,
    },
  ],
  quotedTweetId: null,
  card: null,
  coverMediaIndex: null,
};

// A text-only tweet — no media, so the card renders the author + tweet text.
const twitterText: TwitterDetails = {
  tweetId: "text-only-example",
  authorName: "Paul Graham",
  authorUsername: "paulg",
  authorAvatarUrl:
    "https://pbs.twimg.com/profile_images/1824002576/pg-railsconf_normal.jpg",
  text: "The most successful founders are relentlessly resourceful. When they hit an obstacle they find a way around it, instead of giving up.",
  postedAt: "2024-03-01T09:00:00.000Z",
  media: null,
  quotedTweetId: null,
  card: null,
  coverMediaIndex: null,
};

const instagram: InstagramDetails = {
  postId: "post-example",
  mediaType: "post",
  authorName: "National Geographic",
  authorUsername: "natgeo",
  caption:
    "A rare snow leopard captured on camera in the Himalayas. An incredible encounter that took our team three weeks in the field to film.",
  postedAt: "2024-02-01T10:00:00.000Z",
  media: [
    {
      type: "photo",
      url: "https://picsum.photos/seed/abode-instagram/600/600",
      width: 600,
      height: 600,
    },
  ],
  likeCount: 12000,
  commentCount: 340,
  coverMediaIndex: null,
};

const video: VideoDetails = {
  platform: "youtube",
  videoId: "dQw4w9WgXcQ",
  channelName: "Rick Astley",
  channelUrl: "https://youtube.com/@RickAstley",
  duration: 213,
  embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
};

type TypeSpec = {
  key: string;
  label: string;
  // Media tiles need a defined box for the image to fill, so they get an
  // aspect-ratio (mirroring how the grid sizes a tile from the item's stored
  // dimensions). Text tiles omit it and shrink-wrap their content, like the
  // grid's content-measured text items.
  aspectRatio?: string;
  render: () => ReactNode;
};

// Every kind, so the loading treatment can be eyeballed across the board.
// tweet/instagram/video/note are the ones the progressive-render fix affects
// (their thumbnail lives in coverFileKey, so they render their own card rather
// than a plain image); image/article/product/book already showed via previewUrl
// and are here for completeness.
const TYPES: TypeSpec[] = [
  {
    key: "twitter-photo",
    label: "Tweet · photo",
    aspectRatio: "3 / 2",
    render: () => <TwitterCard twitterDetails={twitterPhoto} onClick={noop} />,
  },
  {
    key: "twitter-text",
    label: "Tweet · text",
    render: () => <TwitterCard twitterDetails={twitterText} onClick={noop} />,
  },
  {
    key: "instagram",
    label: "Instagram",
    aspectRatio: "1 / 1",
    render: () => <InstagramCard instagramDetails={instagram} onClick={noop} />,
  },
  {
    key: "video",
    // Intrinsically 16:9, so the tile aspect matches the card.
    label: "Video",
    aspectRatio: "16 / 9",
    render: () => (
      <VideoCard
        videoDetails={video}
        coverFileKey={null}
        title="Never Gonna Give You Up"
        onClick={noop}
      />
    ),
  },
  {
    key: "note",
    label: "Note",
    render: () => (
      <NoteCard
        title="Launch checklist"
        content={
          "- ship the progressive card render\n- record a walkthrough\n- write the release notes"
        }
        onClick={noop}
      />
    ),
  },
  {
    key: "article",
    label: "Article",
    render: () => (
      <ArticleCard
        title="The hidden cost of context switching"
        content="Deep work compounds; every interruption resets the clock and the tax is higher than it feels."
        domain="example.com"
        author="Jane Doe"
        publishedAt="2024-01-10T00:00:00.000Z"
        readingTime={6}
        coverUrl={null}
        onClick={noop}
      />
    ),
  },
  {
    key: "image",
    label: "Image",
    aspectRatio: "1 / 1",
    render: () => (
      <div
        className="h-full w-full overflow-hidden bg-gray-900"
        style={gridCardStyle}
      >
        {/* biome-ignore lint/performance/noImgElement: static story fixture */}
        <img
          src="https://picsum.photos/seed/abode-image/500/500"
          alt="Sunset over mountains"
          className="h-full w-full object-cover"
        />
      </div>
    ),
  },
  {
    key: "product",
    label: "Product",
    aspectRatio: "5 / 6",
    render: () => (
      <div
        className="h-full w-full overflow-hidden bg-gray-900"
        style={gridCardStyle}
      >
        {/* biome-ignore lint/performance/noImgElement: static story fixture */}
        <img
          src="https://picsum.photos/seed/abode-product/500/600"
          alt="Product"
          className="h-full w-full object-cover"
        />
      </div>
    ),
  },
  {
    key: "book",
    label: "Book",
    aspectRatio: "3 / 4",
    render: () => (
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950"
        style={{
          ...gridCardStyle,
          padding: `${BOOK_TILE_PADDING_Y * 100}% ${BOOK_TILE_PADDING_X * 100}%`,
        }}
      >
        <BookCover3D
          src="https://covers.openlibrary.org/b/isbn/9780141036144-L.jpg"
          alt="Nineteen Eighty-Four"
        />
      </div>
    ),
  },
];

function CardTile({
  spec,
  status,
}: {
  spec: TypeSpec;
  status: ProcessingStatus;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">{spec.label}</span>
      <div
        className="relative w-[250px]"
        style={spec.aspectRatio ? { aspectRatio: spec.aspectRatio } : undefined}
      >
        <ProcessingOverlay status={status} />
        {spec.render()}
      </div>
    </div>
  );
}

function StateGrid({ status }: { status: ProcessingStatus }) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      {TYPES.map((spec) => (
        <CardTile key={spec.key} spec={spec} status={status} />
      ))}
    </div>
  );
}

// Each tile loops processing → completed on its own, phase-offset so the
// Analyzing pills settle (and return) in a staggered wave. The overlay fades on
// every transition, so the settle is visible rather than an instant pop.
const PROCESSING_MS = 1600;
const COMPLETED_MS = 2600;

function LoadInTile({ spec, offsetMs }: { spec: TypeSpec; offsetMs: number }) {
  const [status, setStatus] = useState<ProcessingStatus>("processing");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = (next: ProcessingStatus) => {
      setStatus(next);
      timer = setTimeout(
        () => loop(next === "processing" ? "completed" : "processing"),
        next === "processing" ? PROCESSING_MS : COMPLETED_MS,
      );
    };
    // Hold the initial processing state through the stagger, then start looping.
    const start = setTimeout(() => loop("completed"), offsetMs + PROCESSING_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [offsetMs]);
  return <CardTile spec={spec} status={status} />;
}

function LoadInDemo() {
  return (
    <div className="flex flex-wrap items-start gap-6">
      {TYPES.map((spec, i) => (
        <LoadInTile key={spec.key} spec={spec} offsetMs={i * 350} />
      ))}
    </div>
  );
}

const meta: Meta = {
  title: "Dashboard/Item Card States",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj;

/** Detail row present, item still enriching — the card with the Analyzing pill. */
export const Processing: Story = {
  render: () => <StateGrid status="processing" />,
};

/** Enrichment finished — the settled card with no overlay. */
export const Completed: Story = {
  render: () => <StateGrid status="completed" />,
};

/** Processing failed after the detail row landed — the card with a Failed badge. */
export const Failed: Story = {
  render: () => <StateGrid status="failed" />,
};

/** Auto-cycling: watch each kind's Analyzing pill settle as it loads in. */
export const LoadIn: Story = {
  render: () => <LoadInDemo />,
};
