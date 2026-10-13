import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ComponentProps } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ItemDetailView } from "./item-detail-view";

// Single-line paragraphs so offsets into the source match the rendered text;
// the highlight sits in the first paragraph, which starts the article's text
const CONTENT = [
  "Most improvements are small. They compound quietly: a slightly faster build, a slightly clearer name, a test that catches the thing before it ships. Nobody notices any one of them. Everybody notices the sum.",
  "## Start with the annoyance",
  "Pick the thing that irritates you every day and fix just that. Then pick the next one. Within a month the place feels different, and nobody can say quite why.",
  "## Keep a list",
  "Write the annoyances down as you notice them. The list is the backlog; the habit is the work.",
].join("\n\n");

const QUOTE = "Nobody notices any one of them. Everybody notices the sum.";
const highlight = {
  id: "11111111-1111-4111-8111-111111111111",
  startOffset: CONTENT.indexOf(QUOTE),
  endOffset: CONTENT.indexOf(QUOTE) + QUOTE.length,
  text: QUOTE,
  note: null,
};

const article = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "article",
  processingStatus: "completed",
  fileKey: null,
  coverFileKey: null,
  faviconFileKey: null,
  meta: { originalName: "How to make everything slightly better" },
  sourceType: "url",
  sourceUrl: "https://example.com/slightly-better",
  title: "How to make everything slightly better",
  description: null,
  tags: [],
  userTags: [],
  objects: [],
  colors: [],
  ocrText: null,
  captureDate: null,
  locations: [],
  articleDetails: {
    author: null,
    domain: "example.com",
    publishedAt: null,
    readingTime: 3,
    content: CONTENT,
    scrollProgress: null,
    readAt: null,
    progressUpdatedAt: null,
  },
  twitterDetails: null,
  instagramDetails: null,
  videoDetails: null,
  productDetails: null,
  bookDetails: null,
  createdAt: "2026-10-01T12:00:00.000Z",
} satisfies ComponentProps<typeof ItemDetailView>["item"];

// The public item page; with a featured highlight it's the page a shared
// highlight link opens: the quote up top, the article beneath
const meta = {
  title: "Public/ItemDetailView",
  component: ItemDetailView,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    item: article,
    owner: {
      username: "fred",
      firstName: "Fred",
      lastName: "Rivett",
      avatarUrl: null,
    },
    isOwner: false,
    highlights: [],
    scrollToHighlightId: null,
    roomContext: null,
  },
} satisfies Meta<typeof ItemDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Article: Story = {};

export const SharedHighlight: Story = {
  args: { highlights: [highlight], featuredHighlight: highlight },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The quote is attributed to its owner
    await expect(canvas.getByText("@fred")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Read in context" }),
    );
    // The highlight is marked in the article so "read in context" lands on it
    await waitFor(() =>
      expect(
        canvasElement.querySelector(
          `mark[data-highlight-id="${highlight.id}"]`,
        ),
      ).not.toBeNull(),
    );
  },
};
