import type { Meta, StoryObj } from "@storybook/react";
import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { expect, waitFor } from "storybook/test";
import { ArticleCard } from "@/components/article/article-card";
import { NoteCard } from "@/components/note/note-card";
import { TwitterCard } from "@/components/twitter/twitter-card";
import type { TwitterDetails } from "@/components/twitter/types";
import type { Item } from "@/lib/types/item";
import { articleCoverAspect } from "./article-card-layout";
import { type CardFitKind, cardFitIssue, isCardFitKind } from "./card-fit";
import { getCardFrame } from "./card-frame";
import {
  getCardFontEpoch,
  measureCardText,
  subscribeCardFonts,
} from "./card-text-measurer";
import { getItemDisplayName } from "./item-display-name";

/**
 * Checks the grid's height estimates against the real cards: every text card
 * is rendered at its natural height across grid densities, and must fit the
 * frame `getCardFrame` reserves for it, by `cardFitIssue` — the same rule the
 * debug-trace grid check applies to real items. The estimators mirror card CSS
 * by hand, so this is what catches them drifting apart. Add a fixture for
 * every bad fit found in the wild (the grid check names them).
 */

const noop = () => {};

// Real density presets (`grid-density-store`): column width × card font scale
const DENSITIES = [
  { columnWidth: 100, fontScale: 0.75 },
  { columnWidth: 150, fontScale: 0.9 },
  { columnWidth: 200, fontScale: 1 },
  { columnWidth: 250, fontScale: 1 },
  { columnWidth: 320, fontScale: 1.2 },
  { columnWidth: 480, fontScale: 1.6 },
];

/**
 * Misfits found when this check was added, each still to fix in its estimator
 * (`issue — case`, at any width). Fixing one makes it disappear; anything not
 * listed fails. Keyed without widths so font-rendering differences between
 * platforms can't flake the check.
 */
const KNOWN_MISFITS = new Set<string>([]);

const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function item(fields: Partial<Item>): Item {
  return {
    id: "fit",
    kind: null,
    processingStatus: "completed",
    fileKey: null,
    coverFileKey: null,
    faviconFileKey: null,
    meta: null,
    sourceType: "url",
    sourceUrl: null,
    captureSource: "web",
    title: null,
    description: null,
    tags: [],
    userTags: [],
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    addedAt: "2026-01-01T00:00:00.000Z",
    objects: [],
    colors: [],
    ocrText: null,
    captureDate: null,
    blurDataUrl: null,
    locations: [],
    articleDetails: null,
    twitterDetails: null,
    instagramDetails: null,
    videoDetails: null,
    productDetails: null,
    bookDetails: null,
    noteDetails: null,
    ...fields,
  };
}

const note = (title: string | null, content: string) =>
  item({ kind: "note", sourceType: null, title, noteDetails: { content } });

function tweet(text: string, avatar = true): Item {
  const details: TwitterDetails = {
    tweetId: "1",
    authorName: "Ada Lovelace",
    authorUsername: "ada",
    authorAvatarUrl: avatar ? PIXEL : null,
    text,
    postedAt: "2025-03-01T09:00:00.000Z",
    media: null,
    quotedTweetId: null,
    isTruncated: false,
    quotedTweet: null,
    poll: null,
    inReplyTo: null,
    card: null,
    coverMediaIndex: null,
  };
  return item({ kind: "twitter", twitterDetails: details });
}

function article(
  fields: Partial<Item> & {
    cover?: { width: number; height: number };
    content?: string | null;
    author?: string | null;
    readingTime?: number | null;
  },
): Item {
  const { cover, content = null, author = null, readingTime = null } = fields;
  return item({
    kind: "article",
    sourceUrl: "https://www.example.com/posts/a-long-path",
    coverFileKey: cover ? "cover" : null,
    meta: cover ? { coverWidth: cover.width, coverHeight: cover.height } : null,
    articleDetails: {
      author,
      domain: "www.example.com",
      publishedAt: "2025-06-02T00:00:00.000Z",
      readingTime,
      content,
    } as Item["articleDetails"],
    ...fields,
  });
}

const LOREM =
  "The quick brown fox jumps over the lazy dog while the committee deliberates on the finer points of the agenda.";

const CASES: Array<{ label: string; item: Item }> = [
  { label: "note: one line", item: note(null, "Buy milk") },
  {
    label: "note: title + paragraphs",
    item: note("Weekend plans", `${LOREM}\n\n${LOREM}`),
  },
  {
    label: "note: headings",
    item: note(null, `# Heading one\n\n${LOREM}\n\n## Heading two\n\nShort.`),
  },
  {
    label: "note: code block",
    item: note("Snippet", "```ts\nconst a = 1;\nconst b = a + 1;\n```"),
  },
  {
    label: "note: lazy blockquote",
    item: note(null, `> ${LOREM}\ncontinues lazily here\n\nAfter.`),
  },
  {
    label: "note: quote with two paragraphs",
    item: note(null, `> ${LOREM}\n>\n> And a second paragraph.`),
  },
  {
    label: "note: checklists",
    item: note(null, "* [ ] first\n* [x] second\n- [ ] third\n- [x] fourth"),
  },
  {
    label: "note: paragraph + long bullets",
    item: note(null, `Before the list.\n\n- ${LOREM}\n- A short one`),
  },
  {
    label: "note: numbered list",
    item: note(null, "1. one\n2. two\n3. three"),
  },
  {
    label: "note: hard breaks",
    item: note(null, "line one  \nline two\\\nline three"),
  },
  {
    label: "note: short paragraph",
    item: note(null, "Committee deliberates about points on the agenda."),
  },
  {
    label: "note: NBSP",
    item: note(
      null,
      "Mr.\u00a0Smith went\u00a0to\u00a0Washington on a long day",
    ),
  },
  {
    label: "note: long unbroken URL",
    item: note(
      null,
      "See https://example.com/a/very/long/path/that/never/breaks/anywhere/at/all",
    ),
  },
  {
    label: "note: hyphenated URL",
    item: note(
      null,
      "Read https://www.example.com/blog/2025/06/grid-layouts/explained before the call on Friday",
    ),
  },
  {
    label: "note: hyphens + dashes",
    item: note(
      null,
      "A well-known, long-standing approach—one that re-examines state-of-the-art grids—runs 10–20 pages",
    ),
  },
  {
    label: "note: URL mid-sentence",
    item: note(
      null,
      "Read https://www.example.com/blog/2025/06/masonry/layouts/explained before the call on Friday",
    ),
  },
  {
    label: "note: emoji + CJK",
    item: note(null, "今日はいい天気ですね 🌞🌞🌞 散歩に行きましょう 🚶‍♀️"),
  },
  { label: "note: title only", item: note(`${LOREM} ${LOREM}`, "") },
  {
    label: "note: very long (clamped)",
    item: note(null, Array.from({ length: 12 }, () => LOREM).join("\n\n")),
  },
  { label: "tweet: short", item: tweet("gm") },
  { label: "tweet: long, no avatar", item: tweet(`${LOREM} ${LOREM}`, false) },
  {
    label: "tweet: newlines + whitespace runs",
    item: tweet("first line\n\nthird line    spaced\n- a\n- b"),
  },
  {
    label: "tweet: emoji + CJK",
    item: tweet("新しいプロジェクト 🚀🚀 始めました！"),
  },
  {
    label: "article: cover, long title, full byline",
    item: article({
      title: `${LOREM} ${LOREM}`,
      cover: { width: 1200, height: 630 },
      author: "Jonathan Q. Featherstonehaugh",
      readingTime: 12,
    }),
  },
  {
    label: "article: cover, untitled",
    item: article({ cover: { width: 800, height: 800 } }),
  },
  {
    label: "article: text, description teaser",
    item: article({ title: "Why grids are hard", description: LOREM }),
  },
  {
    label: "article: text, content teaser",
    item: article({
      title: "From the body",
      content: `# Heading\n\nBy someone\n\n${LOREM} ${LOREM}`,
    }),
  },
  {
    label: "article: text, no teaser",
    item: article({ title: "Just a title", description: "Too short" }),
  },
];

/** The leaf card `ItemCard` renders for these kinds, with the same props */
function Card({ item }: { item: Item }) {
  if (item.kind === "note") {
    return (
      <NoteCard
        title={item.title}
        content={item.noteDetails?.content ?? ""}
        onClick={noop}
      />
    );
  }
  if (item.kind === "twitter" && item.twitterDetails) {
    return (
      <TwitterCard
        twitterDetails={item.twitterDetails}
        itemId={item.id}
        onClick={noop}
      />
    );
  }
  const details = item.articleDetails;
  const hasCover = !!item.coverFileKey && !item.coverHidden;
  return (
    <ArticleCard
      title={getItemDisplayName(item)}
      description={item.description}
      content={details?.content ?? null}
      domain={details?.domain ?? null}
      author={details?.author ?? null}
      publishedAt={details?.publishedAt ?? null}
      readingTime={details?.readingTime ?? null}
      faviconUrl={null}
      coverUrl={hasCover ? PIXEL : null}
      onClick={noop}
    />
  );
}

const FIT_KIND: Partial<Record<string, CardFitKind>> = {
  note: "note",
  twitter: "tweet",
  article: "article",
};

function FitCase({
  label,
  item,
  columnWidth,
  fontScale,
  rootRemPx,
}: {
  label: string;
  item: Item;
  columnWidth: number;
  fontScale: number;
  rootRemPx: number;
}) {
  const aspect = getCardFrame(item, {
    columnWidth,
    rootRemPx,
    cardRootPx: fontScale * rootRemPx,
    measure: measureCardText,
  });
  const frame = (columnWidth * aspect.height) / aspect.width;
  // The cover band soaks up slack (it collapses at natural height), so a
  // covered article needs its cover's height on top of the caption
  const cover =
    item.kind === "article" && item.coverFileKey
      ? columnWidth / articleCoverAspect(item.meta)
      : 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground">
        {label} · {columnWidth}px
      </span>
      <div className="flex items-start gap-1">
        {/* What the grid reserves */}
        <div
          style={{ width: columnWidth, height: frame } as CSSProperties}
          className="outline outline-1 outline-red-400"
        >
          <Card item={item} />
        </div>
        {/* What the content needs */}
        <div
          data-fit={label}
          data-kind={FIT_KIND[item.kind ?? ""]}
          data-column-width={columnWidth}
          data-frame={frame}
          data-cover={cover}
          style={{ width: columnWidth }}
        >
          <Card item={item} />
        </div>
      </div>
    </div>
  );
}

function CardFitBench({ rootRemPx }: { rootRemPx: number }): ReactNode {
  // Estimates measure text with the real fonts, so wait for them (and for the
  // root size) before rendering anything
  const [ready, setReady] = useState(false);
  // Like `useCardFrame`: re-measure once fonts the cards request finish loading
  useSyncExternalStore(subscribeCardFonts, getCardFontEpoch, () => 0);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = `${rootRemPx}px`;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      root.style.fontSize = previous;
    };
  }, [rootRemPx]);
  if (!ready) return null;
  return (
    <div className="flex flex-col gap-6">
      {DENSITIES.map(({ columnWidth, fontScale }) => (
        <div
          key={columnWidth}
          className="flex flex-wrap items-start gap-4"
          style={{ "--grid-font-scale": fontScale } as CSSProperties}
        >
          {CASES.map(({ label, item }) => (
            <FitCase
              key={label}
              label={label}
              item={item}
              columnWidth={columnWidth}
              fontScale={fontScale}
              rootRemPx={rootRemPx}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Every case that doesn't fit (and isn't a known misfit), with its sizes */
function badFits(canvas: HTMLElement): string[] {
  return [...canvas.querySelectorAll<HTMLElement>("[data-fit]")].flatMap(
    (el) => {
      const kind = el.dataset.kind ?? null;
      if (!isCardFitKind(kind)) return [`no fit kind — ${el.dataset.fit}`];
      const width = Number(el.dataset.columnWidth);
      const frame = Number(el.dataset.frame);
      const natural =
        el.getBoundingClientRect().height + Number(el.dataset.cover);
      const issue = cardFitIssue({ kind, width, frame, natural });
      return issue && !KNOWN_MISFITS.has(`${issue} — ${el.dataset.fit}`)
        ? [
            `${issue} — ${el.dataset.fit} @ ${width}px: frame ${frame.toFixed(1)}, content ${natural.toFixed(1)}`,
          ]
        : [];
    },
  );
}

async function expectAllFit(canvasElement: HTMLElement) {
  // The bench renders once fonts are ready, which can take a while on a cold run
  await waitFor(
    () =>
      expect(canvasElement.querySelectorAll("[data-fit]")).toHaveLength(
        CASES.length * DENSITIES.length,
      ),
    { timeout: 10_000 },
  );
  // Serif titles only request their font once they render, so the fits settle
  // after it loads and the bench re-measures
  await waitFor(() => expect(badFits(canvasElement)).toEqual([]), {
    timeout: 5_000,
  });
}

const meta = {
  title: "Grid/CardFit",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Each card at its reserved frame (red outline) beside its natural height */
export const DefaultTextSize: Story = {
  render: () => <CardFitBench rootRemPx={16} />,
  play: ({ canvasElement }) => expectAllFit(canvasElement),
};

/** Same, with the browser text size turned up (rem-aware estimates) */
export const LargeTextSize: Story = {
  render: () => <CardFitBench rootRemPx={20} />,
  play: ({ canvasElement }) => expectAllFit(canvasElement),
};
