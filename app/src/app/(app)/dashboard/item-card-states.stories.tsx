"use client";

import type { ProcessingStatus } from "@prisma/client";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ArticleCard } from "@/components/article/article-card";
import { InstagramCard } from "@/components/instagram/instagram-card";
import type { InstagramDetails } from "@/components/instagram/types";
import { NoteCard } from "@/components/note/note-card";
import { TwitterCard } from "@/components/twitter/twitter-card";
import type { TwitterDetails } from "@/components/twitter/types";
import { VideoCard } from "@/components/video/video-card";
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

const twitter: TwitterDetails = {
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

const instagram: InstagramDetails = {
  postId: "reel-example",
  mediaType: "reel",
  authorName: "National Geographic",
  authorUsername: "natgeo",
  caption:
    "A rare snow leopard captured on camera in the Himalayas. An incredible encounter that took our team three weeks in the field to film.",
  postedAt: "2024-02-01T10:00:00.000Z",
  media: null,
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
  height: number;
  render: () => ReactNode;
};

// Each kind whose thumbnail lives in coverFileKey (so it renders its own card
// rather than a plain image) plus notes — the kinds the progressive-render fix
// affects. Image/article-with-cover/product/book show via previewUrl instead.
const TYPES: TypeSpec[] = [
  {
    key: "twitter",
    label: "Tweet",
    height: 320,
    render: () => <TwitterCard twitterDetails={twitter} onClick={noop} />,
  },
  {
    key: "instagram",
    label: "Instagram",
    height: 320,
    render: () => <InstagramCard instagramDetails={instagram} onClick={noop} />,
  },
  {
    key: "video",
    label: "Video",
    height: 200,
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
    height: 240,
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
    height: 320,
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
      <div className="relative w-[250px]" style={{ height: spec.height }}>
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

// Flips from `processing` to `completed` after a per-card delay so the Analyzing
// pills settle in a staggered wave, imitating how items load in.
function LoadInTile({ spec, delayMs }: { spec: TypeSpec; delayMs: number }) {
  const [status, setStatus] = useState<ProcessingStatus>("processing");
  useEffect(() => {
    const id = setTimeout(() => setStatus("completed"), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return <CardTile spec={spec} status={status} />;
}

function LoadInDemo() {
  // Bumping `cycle` remounts every tile, replaying the processing → completed
  // transition on a loop.
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCycle((n) => n + 1), 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-wrap items-start gap-6">
      {TYPES.map((spec, i) => (
        <LoadInTile
          key={`${spec.key}-${cycle}`}
          spec={spec}
          delayMs={500 + i * 500}
        />
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
