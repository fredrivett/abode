import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import { NoteCard } from "@/components/note/note-card";
import { TwitterCard } from "@/components/twitter/twitter-card";
import type { TwitterDetails } from "@/components/twitter/types";
import {
  estimateNoteAspect,
  estimateTweetAspect,
  type FrameAspect,
} from "@/lib/items/card-aspect";
import { measureCardText } from "@/lib/items/card-text-measurer";

/**
 * Showcase + manual test bench for the content-driven card height estimators.
 *
 * The estimator turns a card's content into a masonry frame aspect ratio, which
 * is all these stories need — no auth or real data. `Playground` is the live
 * bench (type content, drag the column width). The galleries pin representative
 * edge cases. `Masonry` drops the whole set into the real grid so you can judge
 * how the varied heights pack together.
 */
const noop = () => {};
const AVATAR =
  "https://pbs.twimg.com/profile_images/1329647526807543809/2SGvnHYV_normal.jpg";

type PlaygroundArgs = {
  kind: "note" | "tweet";
  title: string;
  content: string;
  hasAvatar: boolean;
  columnWidthPx: number;
};

const meta = {
  title: "Grid/ContentDrivenHeights",
  parameters: { layout: "padded" },
  args: { columnWidthPx: 250 },
  argTypes: {
    kind: { control: "inline-radio", options: ["note", "tweet"] },
    title: { control: "text", if: { arg: "kind", eq: "note" } },
    content: { control: "text" },
    hasAvatar: { control: "boolean", if: { arg: "kind", eq: "tweet" } },
    columnWidthPx: { control: { type: "range", min: 80, max: 500, step: 10 } },
  },
} satisfies Meta<PlaygroundArgs>;

export default meta;
type Story = StoryObj<PlaygroundArgs>;

// A masonry column: a fixed-width box whose aspect ratio the estimator chose.
function AspectBox({
  aspect,
  columnWidthPx,
  label,
  children,
}: {
  aspect: FrameAspect;
  columnWidthPx: number;
  label?: string;
  children: ReactNode;
}) {
  // Explicit height (not CSS aspect-ratio): outside the masonry grid, a
  // `h-full` card won't honor an aspect-ratio box, so a definite height is what
  // makes the clamp + overflow-fade render faithfully here.
  const heightPx = Math.round((columnWidthPx * aspect.height) / aspect.width);
  return (
    <div className="flex flex-col gap-1" style={{ width: columnWidthPx }}>
      <div style={{ height: heightPx }}>{children}</div>
      {label && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {label} · {(aspect.width / aspect.height).toFixed(2)}
        </span>
      )}
    </div>
  );
}

function tweet(
  text: string,
  {
    hasAvatar = true,
    name = "Test User",
  }: { hasAvatar?: boolean; name?: string } = {},
): TwitterDetails {
  return {
    tweetId: text.slice(0, 16),
    authorName: name,
    authorUsername: "testuser",
    authorAvatarUrl: hasAvatar ? AVATAR : null,
    text,
    postedAt: "2024-01-15T12:00:00.000Z",
    media: null,
    quotedTweetId: null,
    card: null,
    coverMediaIndex: null,
  };
}

// --- Edge-case fixtures ------------------------------------------------------

const NOTE_CASES: { label: string; title: string | null; content: string }[] = [
  { label: "empty", title: null, content: "" },
  { label: "one word", title: null, content: "Groceries" },
  {
    label: "one line + emoji",
    title: null,
    content: "Cancel the trial before the 30th 💸",
  },
  {
    label: "short + title",
    title: "Idea",
    content: "A one-line thought under a title.",
  },
  {
    label: "bullet list",
    title: "Grocery run",
    content: "- Milk\n- Eggs\n- Coffee\n- Bread",
  },
  {
    label: "numbered + heading",
    title: null,
    content:
      "# Reading list\n\n1. The Bitter Lesson\n2. Trusting Trust\n3. A Plan for Spam",
  },
  {
    label: "headings + paras",
    title: "Onboarding ideas",
    content:
      "Spoke to Sarah about the onboarding flow today.\n\n## Takeaways\n\n- New users drop off at the empty dashboard\n- A prompt could give them something to do\n\nFollow up next week.",
  },
  {
    label: "code block",
    title: "Snippet",
    content:
      "Fix the off-by-one:\n\n```\nfor (let i = 0; i <= n; i++) {\n  total += row[i];\n}\n```\n\nShould be `< n`.",
  },
  {
    label: "blockquote",
    title: null,
    content:
      "> The best way to predict the future is to invent it.\n\n— Alan Kay",
  },
  {
    label: "long title (clamp)",
    title:
      "A deliberately long note title that runs well past two lines to prove the line-clamp is respected in the estimate",
    content: "Short body.",
  },
  {
    label: "long URL",
    title: null,
    content:
      "See https://example.com/some/really/long/path/that/cannot/wrap/nicely?q=1&ref=abcdefghijklmnop",
  },
  {
    label: "very long (clamp)",
    title: "Retro notes",
    content: Array.from(
      { length: 12 },
      (_, i) =>
        `Point ${i + 1}: something we learned this sprint that is worth writing down properly.`,
    ).join("\n\n"),
  },
];

const TWEET_CASES: { label: string; details: TwitterDetails }[] = [
  { label: "short", details: tweet("let that sink in") },
  {
    label: "hard newlines",
    details: tweet(
      "Introducing `react-tweet`:\n\n◆ 35x less client-side JavaScript\n◆ React Server Components\n◆ Works with Next.js, Vite, CRA",
    ),
  },
  {
    label: "no avatar",
    details: tweet("A tweet from a user without a profile picture.", {
      hasAvatar: false,
    }),
  },
  {
    label: "emoji",
    details: tweet(
      "shipping 🚀🚀🚀 big week for the team 🎉 so proud of everyone 🙌",
    ),
  },
  {
    label: "CJK",
    details: tweet(
      "今日は良い天気ですね。散歩に行きましょう。それからコーヒーを飲みます。",
    ),
  },
  {
    label: "long URL",
    details: tweet(
      "great read: https://example.com/articles/2024/the-very-long-slug-that-will-not-wrap-cleanly-at-all",
    ),
  },
  {
    label: "long (clamp)",
    details: tweet(
      "This is an extremely long tweet that goes on and on to test how the height estimate tracks the text. Past the clamp the card stops growing and the fade takes over, so a wall of text never dominates the whole column the way a fixed-height card would.",
    ),
  },
];

// --- Stories -----------------------------------------------------------------

/** Live bench: edit the content and drag the column width. */
export const Playground: Story = {
  args: {
    kind: "note",
    title: "Onboarding ideas",
    content:
      "Spoke to Sarah today.\n\n- Users drop off at the empty dashboard\n- A prompt could help\n\nFollow up next week.",
    hasAvatar: true,
    columnWidthPx: 250,
  },
  render: ({ kind, title, content, hasAvatar, columnWidthPx }) => {
    const aspect =
      kind === "note"
        ? estimateNoteAspect(
            { title: title || null, body: content },
            { columnWidthPx, cardRootPx: 16, measure: measureCardText },
          )
        : estimateTweetAspect(
            { text: content, hasAvatar },
            { columnWidthPx, measure: measureCardText },
          );
    return (
      <AspectBox aspect={aspect} columnWidthPx={columnWidthPx} label="aspect">
        {kind === "note" ? (
          <NoteCard title={title || null} content={content} onClick={noop} />
        ) : (
          <TwitterCard
            twitterDetails={tweet(content, { hasAvatar })}
            onClick={noop}
          />
        )}
      </AspectBox>
    );
  },
};

export const Notes: Story = {
  render: ({ columnWidthPx }) => (
    <div className="flex flex-wrap items-start gap-5">
      {NOTE_CASES.map((c) => (
        <AspectBox
          key={c.label}
          columnWidthPx={columnWidthPx}
          label={c.label}
          aspect={estimateNoteAspect(
            { title: c.title, body: c.content },
            { columnWidthPx, cardRootPx: 16, measure: measureCardText },
          )}
        >
          <NoteCard title={c.title} content={c.content} onClick={noop} />
        </AspectBox>
      ))}
    </div>
  ),
};

export const Tweets: Story = {
  render: ({ columnWidthPx }) => (
    <div className="flex flex-wrap items-start gap-5">
      {TWEET_CASES.map((c) => (
        <AspectBox
          key={c.label}
          columnWidthPx={columnWidthPx}
          label={c.label}
          aspect={estimateTweetAspect(
            {
              text: c.details.text ?? "",
              hasAvatar: !!c.details.authorAvatarUrl,
            },
            { columnWidthPx, measure: measureCardText },
          )}
        >
          <TwitterCard twitterDetails={c.details} onClick={noop} />
        </AspectBox>
      ))}
    </div>
  ),
};

/** Same note across column widths — proves the estimate tracks grid density. */
export const DensitySweep: Story = {
  render: () => {
    const note =
      NOTE_CASES.find((c) => c.label === "headings + paras") ?? NOTE_CASES[0];
    return (
      <div className="flex flex-wrap items-start gap-5">
        {[120, 160, 220, 300, 400].map((columnWidthPx) => (
          <AspectBox
            key={columnWidthPx}
            columnWidthPx={columnWidthPx}
            label={`${columnWidthPx}px`}
            aspect={estimateNoteAspect(
              { title: note.title, body: note.content },
              { columnWidthPx, cardRootPx: 16, measure: measureCardText },
            )}
          >
            <NoteCard
              title={note.title}
              content={note.content}
              onClick={noop}
            />
          </AspectBox>
        ))}
      </div>
    );
  },
};

// Interleaved notes + tweets for the real masonry layout.
type Sample =
  | { kind: "note"; id: string; title: string | null; content: string }
  | { kind: "tweet"; id: string; details: TwitterDetails };

const MASONRY_SAMPLES: Sample[] = [
  ...NOTE_CASES.map((c, i) => ({
    kind: "note" as const,
    id: `n${i}`,
    title: c.title,
    content: c.content,
  })),
  ...TWEET_CASES.map((c, i) => ({
    kind: "tweet" as const,
    id: `t${i}`,
    details: c.details,
  })),
].filter((s) => !(s.kind === "note" && s.content === "" && s.title === null));

// A fixed container width whose columns land exactly on FRAME_WIDTH (no `1fr`
// stretch), so the estimator's column width matches the real layout without a
// measuring hook — Storybook's nextjs-vite framework crashes on `"use client"`
// hook modules in the render path.
const FRAME_WIDTH = 240;
const GAP = 12;
const COLS = 4;
const CONTAINER_WIDTH = COLS * FRAME_WIDTH + (COLS - 1) * GAP;

function MasonryDemo() {
  return (
    <div style={{ width: CONTAINER_WIDTH, maxWidth: "100%" }}>
      <BalancedMasonryGrid frameWidth={FRAME_WIDTH} gap={GAP}>
        {MASONRY_SAMPLES.map((s) => {
          const aspect =
            s.kind === "note"
              ? estimateNoteAspect(
                  { title: s.title, body: s.content },
                  {
                    columnWidthPx: FRAME_WIDTH,
                    cardRootPx: 16,
                    measure: measureCardText,
                  },
                )
              : estimateTweetAspect(
                  {
                    text: s.details.text ?? "",
                    hasAvatar: !!s.details.authorAvatarUrl,
                  },
                  { columnWidthPx: FRAME_WIDTH, measure: measureCardText },
                );
          return (
            <Frame key={s.id} width={aspect.width} height={aspect.height}>
              <div className="h-full">
                {s.kind === "note" ? (
                  <NoteCard
                    title={s.title}
                    content={s.content}
                    onClick={noop}
                  />
                ) : (
                  <TwitterCard twitterDetails={s.details} onClick={noop} />
                )}
              </div>
            </Frame>
          );
        })}
      </BalancedMasonryGrid>
    </div>
  );
}

/** The real `BalancedMasonryGrid`, to judge how varied heights pack together. */
export const Masonry: Story = {
  render: () => <MasonryDemo />,
};
