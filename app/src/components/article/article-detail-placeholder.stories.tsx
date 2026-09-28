import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { expect, waitFor } from "storybook/test";
import { Button } from "@/components/ui/button";
import { highlightsQueryKey } from "@/lib/highlights/use-highlights";
import { ArticleDetailPlaceholder } from "./article-detail-placeholder";
import { ArticleDetailView } from "./article-detail-view";

const TITLE = "How to make everything slightly better";
const CONTENT = `Most improvements are small. They compound quietly: a slightly faster
build, a slightly clearer name, a test that catches the thing before it ships.

Nobody notices any one of them. Everybody notices the sum.

## Start with the annoyance

Pick the thing that irritates you every day and fix just that.`;

const STORY_ITEM_ID = "story-article";

// The real view fetches highlights; seed none so it never hits the network
function withQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  client.setQueryData(highlightsQueryKey(STORY_ITEM_ID), []);
  return client;
}

// Read-only loading stand-in shown while the article reader (a large lazy
// chunk) loads, before the reader replaces it in place
const meta = {
  title: "Article/ArticleDetailPlaceholder",
  component: ArticleDetailPlaceholder,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { title: TITLE },
  decorators: [
    (Story) => (
      <QueryClientProvider client={withQueryClient()}>
        <div className="flex h-[32rem]">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ArticleDetailPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTitle: Story = {};

export const WithoutTitle: Story = { args: { title: undefined } };

function Reader() {
  return (
    <ArticleDetailView
      itemId={STORY_ITEM_ID}
      content={CONTENT}
      originalName={TITLE}
      enableTracking={false}
    />
  );
}

function SwapDemo() {
  const [showReader, setShowReader] = useState(false);
  return (
    <div className="flex w-full flex-col">
      <div className="p-3">
        <Button size="sm" onClick={() => setShowReader((shown) => !shown)}>
          {showReader ? "Show placeholder" : "Show reader"}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        {showReader ? <Reader /> : <ArticleDetailPlaceholder title={TITLE} />}
      </div>
    </div>
  );
}

// Flick between the placeholder and the reader that replaces it: the title
// stays put and the text fills in where the skeleton was
export const Swap: Story = {
  render: () => <SwapDemo />,
};

// The reader laid over the placeholder, tinted and semi-transparent. The
// play test checks the title lines up and the first paragraph's lines sit
// exactly on the skeleton's.
export const Overlay: Story = {
  render: () => (
    <div className="relative w-full">
      <div data-layer="placeholder" className="absolute inset-0 flex">
        <ArticleDetailPlaceholder title={TITLE} />
      </div>
      <div
        data-layer="reader"
        className="pointer-events-none absolute inset-0 flex opacity-60 [&_*]:text-red-500!"
      >
        <Reader />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const layer = (name: string) => {
      const element = canvasElement.querySelector(`[data-layer="${name}"]`);
      if (!(element instanceof HTMLElement)) throw new Error(`no ${name}`);
      return element;
    };
    const rectOf = (element: Element | null | undefined) => {
      if (!element) throw new Error("missing element");
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    };
    await waitFor(() =>
      expect(layer("reader").querySelector("article p")).not.toBeNull(),
    );
    // Same title, same place
    expect(rectOf(layer("reader").querySelector("h1"))).toEqual(
      rectOf(layer("placeholder").querySelector("h1")),
    );
    // The first paragraph's lines sit at the same heights in both: same start
    // and same line pitch (the skeleton is real text in the reader's prose)
    const lineTops = (element: Element | null | undefined) => {
      if (!element) throw new Error("missing paragraph");
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      const tops = [...new Set(rects.map((r) => Math.round(r.top)))];
      return { left: Math.round(rects[0].left), tops: tops.slice(0, 2) };
    };
    const readerLines = lineTops(layer("reader").querySelector("article p"));
    const skeletonLines = lineTops(
      layer("placeholder").querySelector("article p"),
    );
    expect(readerLines.tops).toHaveLength(2);
    expect(readerLines).toEqual(skeletonLines);
  },
};
