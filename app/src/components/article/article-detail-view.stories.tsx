import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, waitFor } from "storybook/test";
import { highlightsQueryKey } from "@/lib/highlights/use-highlights";
import { ArticleDetailView } from "./article-detail-view";

const STORY_ITEM_ID = "story-article-view";

const SIMPLE_CONTENT = `Most improvements are small. They compound quietly: a slightly faster
build, a slightly clearer name, a test that catches the thing before it ships.

Nobody notices any one of them. Everybody notices the sum.

## Start with the annoyance

Pick the thing that irritates you every day and fix just that.`;

// Shaped like a captured magazine feature: section breaks (from the source's
// dividers) and a photo caption kept as a figcaption
const SECTIONED_CONTENT = `**The light was already going** by the time we reached the harbour. The boats had come in and the nets lay drying along the wall, and nobody seemed in a hurry to be anywhere else.

We sat at the end of the jetty and talked about nothing much until the lamps came on behind us.

* * *

**Morning came in grey.** The town was quieter than it had been the night before, and the first ferry left half empty, its wake spreading slowly across the flat water of the bay.

“It’s always like this after a storm,” the harbourmaster said. “Give it a day.”

![](/gallery/city-sunset-river.jpg)

<figcaption>PHOTO BY A PHOTOGRAPHER</figcaption>

* * *

**By the third day** the weather had turned, and the harbour filled again with the noise of engines and gulls and people calling to each other across the water.`;

// The real view fetches highlights; seed none so it never hits the network
function withQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  client.setQueryData(highlightsQueryKey(STORY_ITEM_ID), []);
  return client;
}

// The article reader: captured markdown rendered with the reader typography
const meta = {
  title: "Article/ArticleDetailView",
  component: ArticleDetailView,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    itemId: STORY_ITEM_ID,
    content: SIMPLE_CONTENT,
    originalName: "How to make everything slightly better",
    enableTracking: false,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={withQueryClient()}>
        <div className="flex">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ArticleDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Each section after a break opens with a drop cap; the opening paragraph
// stays plain and the caption is set apart from the body text. The play test
// guards the rendered structure the reader's sibling selectors rely on
// (`hr + p`, `p:has(+ figcaption)`), which only exists if captured markdown
// still renders breaks and kept captions as siblings of the paragraphs.
export const Sectioned: Story = {
  args: { content: SECTIONED_CONTENT, originalName: "After the storm" },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector("article figcaption")).not.toBeNull(),
    );
    const firstLetterFloat = (element: Element | null) => {
      if (!element) throw new Error("missing paragraph");
      return getComputedStyle(element, "::first-letter").float;
    };

    const sectionOpeners = canvasElement.querySelectorAll("article hr + p");
    expect(sectionOpeners).toHaveLength(2);
    for (const opener of sectionOpeners) {
      expect(firstLetterFloat(opener)).toBe("left");
    }
    expect(firstLetterFloat(canvasElement.querySelector("article p"))).toBe(
      "none",
    );

    const caption = canvasElement.querySelector("article figcaption");
    const image = caption?.previousElementSibling?.querySelector("img");
    if (!caption || !image) throw new Error("caption isn't next to its image");
    const gap =
      caption.getBoundingClientRect().top -
      image.getBoundingClientRect().bottom;
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(16);
  },
};
