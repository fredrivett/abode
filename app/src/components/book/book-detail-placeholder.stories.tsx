import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { expect } from "storybook/test";
import { Button } from "@/components/ui/button";
import type { BookDetails } from "@/lib/types/item";
import { BookDetailPlaceholder } from "./book-detail-placeholder";
import { BookDetailView } from "./book-detail-view";

// Only authors/domain are read; the rest of BookDetails isn't needed here
const bookDetails = {
  authors: ["Ursula K. Le Guin"],
  domain: "literal.club",
} as unknown as BookDetails;
const TITLE = "The Dispossessed";
const SOURCE_URL = "https://literal.club/book/the-dispossessed";

// Read-only loading stand-in shown while the book view (a lazy chunk) loads,
// before the view replaces it in place. Coverless, so the stories render
// offline (covers go through the image proxy).
const meta = {
  title: "Book/BookDetailPlaceholder",
  component: BookDetailPlaceholder,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { itemId: "book-1", bookDetails, title: TITLE },
  decorators: [
    (Story) => (
      <div className="h-[32rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookDetailPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSourceLink: Story = { args: { sourceUrl: SOURCE_URL } };

function View() {
  return (
    <BookDetailView
      itemId="book-1"
      bookDetails={bookDetails}
      title={TITLE}
      sourceUrl={SOURCE_URL}
    />
  );
}

function Placeholder() {
  return (
    <BookDetailPlaceholder
      itemId="book-1"
      bookDetails={bookDetails}
      title={TITLE}
      sourceUrl={SOURCE_URL}
    />
  );
}

function SwapDemo() {
  const [showView, setShowView] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button size="sm" onClick={() => setShowView((shown) => !shown)}>
          {showView ? "Show placeholder" : "Show book view"}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {showView ? <View /> : <Placeholder />}
      </div>
    </div>
  );
}

// Flick between the placeholder and the book view that replaces it: nothing
// should move
export const Swap: Story = {
  render: () => <SwapDemo />,
};

// The book view laid over the placeholder, tinted and semi-transparent. The
// play test checks the title and authors line up.
export const Overlay: Story = {
  render: () => (
    <div className="relative h-full">
      <div data-layer="placeholder" className="absolute inset-0">
        <Placeholder />
      </div>
      <div
        data-layer="view"
        className="pointer-events-none absolute inset-0 opacity-60 [&_*]:text-red-500!"
      >
        <View />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rectOf = (layer: string, selector: string) => {
      const element = canvasElement.querySelector(
        `[data-layer="${layer}"] ${selector}`,
      );
      if (!element) throw new Error(`no ${selector} in ${layer}`);
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    };
    for (const selector of ["h2", "h2 + p"]) {
      expect(rectOf("view", selector)).toEqual(rectOf("placeholder", selector));
    }
  },
};
