import type { Meta, StoryObj } from "@storybook/nextjs";
import { QuadOverlay } from "./quad-overlay";

const tiltedPage = {
  topLeft: { x: 60, y: 70 },
  topRight: { x: 250, y: 50 },
  bottomRight: { x: 270, y: 330 },
  bottomLeft: { x: 40, y: 350 },
};

const meta = {
  title: "Scanner/QuadOverlay",
  component: QuadOverlay,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="relative h-[400px] w-[300px] bg-neutral-700">
        <Story />
      </div>
    ),
  ],
  args: { quad: tiltedPage, status: "steady" },
} satisfies Meta<typeof QuadOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Page found and held steady */
export const Steady: Story = {};

/** Held long enough to auto-capture */
export const Locked: Story = { args: { status: "locked" } };

/** Page detected but too far away to scan well */
export const TooSmall: Story = { args: { status: "too-small" } };

/** Pulses while the capture is processed */
export const Capturing: Story = { args: { capturing: true } };

/** Nothing detected — renders nothing */
export const NoPage: Story = { args: { quad: null, status: "searching" } };
