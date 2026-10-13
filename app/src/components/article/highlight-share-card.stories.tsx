import type { Meta, StoryObj } from "@storybook/nextjs";
import { HighlightCardPreview } from "./share-highlight-dialog";

// The share card a highlight link unfurls to, shown through the same scaled
// preview the share dialog uses (the OG route renders the identical markup)
const meta = {
  title: "Article/HighlightShareCard",
  component: HighlightCardPreview,
  tags: ["autodocs"],
  args: {
    text: "Nobody notices any one of them. Everybody notices the sum.",
    title: "How to make everything slightly better",
    domain: "example.com",
    ownerUsername: "fred",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HighlightCardPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Short: Story = {};

export const Medium: Story = {
  args: {
    text: "Most improvements are small. They compound quietly: a slightly faster build, a slightly clearer name, a test that catches the thing before it ships.",
  },
};

export const Long: Story = {
  args: {
    text: "The town was quieter than it had been the night before, and the first ferry left half empty, its wake spreading slowly across the flat water of the bay. By the third day the weather had turned, and the harbour filled again with the noise of engines and gulls and people calling to each other across the water, as if nothing had happened at all and nothing ever would.",
  },
};

export const WithoutTitle: Story = {
  args: { title: null, domain: null },
};

export const LongTitle: Story = {
  args: {
    title:
      "The surprisingly long history of the humble harbour wall, and what it can teach us about patience",
  },
};
