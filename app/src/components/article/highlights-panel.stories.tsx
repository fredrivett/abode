import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, userEvent, within } from "storybook/test";
import { highlightsQueryKey } from "@/lib/highlights/use-highlights";
import { HighlightsPanel } from "./highlights-panel";

const STORY_ITEM_ID = "story-highlights-panel";

const HIGHLIGHTS = [
  {
    id: "hl-1",
    itemId: STORY_ITEM_ID,
    startOffset: 0,
    endOffset: 58,
    text: "Nobody notices any one of them. Everybody notices the sum.",
    note: null,
    createdAt: new Date("2026-10-01T09:00:00.000Z"),
    updatedAt: new Date("2026-10-01T09:00:00.000Z"),
  },
  {
    id: "hl-2",
    itemId: STORY_ITEM_ID,
    startOffset: 100,
    endOffset: 220,
    text: "Pick the thing that irritates you every day and fix just that. Then pick the next one. Within a month the place feels different.",
    note: "Try this with the build",
    createdAt: new Date("2026-10-02T09:00:00.000Z"),
    updatedAt: new Date("2026-10-02T09:00:00.000Z"),
  },
];

// Seed the highlights so the panel never hits the network
function withHighlights(highlights: typeof HIGHLIGHTS) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  client.setQueryData(highlightsQueryKey(STORY_ITEM_ID), highlights);
  return client;
}

// The article sidebar's highlights list: jump to, share and delete each one
const meta = {
  title: "Article/HighlightsPanel",
  component: HighlightsPanel,
  tags: ["autodocs"],
  args: { itemId: STORY_ITEM_ID, canEdit: true, onShareHighlight: () => {} },
  decorators: [
    (Story, { parameters }) => (
      <QueryClientProvider
        client={withHighlights(parameters.highlights ?? HIGHLIGHTS)}
      >
        <div style={{ maxWidth: 360 }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  // Open the accordion so the cards show
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Highlights/ }));
  },
} satisfies Meta<typeof HighlightsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async (context) => {
    await meta.play(context);
    const canvas = within(context.canvasElement);
    await expect(
      canvas.getAllByRole("button", { name: "Share highlight" }),
    ).toHaveLength(2);
  },
};

// Read-only viewers can't share or delete
export const ReadOnly: Story = {
  args: { canEdit: false, onShareHighlight: undefined },
};

export const Empty: Story = {
  parameters: { highlights: [] },
};
