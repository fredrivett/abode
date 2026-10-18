import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { SensitiveItemTile } from "./sensitive-item-tile";

// Deterministic inline LQIP so the story renders offline
const lqip = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="10"><rect width="8" height="5" fill="#f97316"/><rect y="5" width="8" height="5" fill="#0ea5e9"/></svg>`,
)}`;

const meta = {
  title: "Items/SensitiveItemTile",
  component: SensitiveItemTile,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { onOpen: fn() },
  decorators: [
    (Story) => (
      <div className="h-80 w-60">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SensitiveItemTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCoverColours: Story = { args: { blurDataUrl: lqip } };

export const WithoutCover: Story = { args: { blurDataUrl: null } };
