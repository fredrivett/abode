import type { Meta, StoryObj } from "@storybook/nextjs";
import { ShutterButton } from "./shutter-button";

const meta = {
  title: "Scanner/ShutterButton",
  component: ShutterButton,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-black p-8">
        <Story />
      </div>
    ),
  ],
  args: { onClick: () => {}, progress: null },
  argTypes: {
    progress: {
      control: { type: "range", min: 0, max: 1, step: 0.05 },
      description: "Auto-capture countdown (null hides the ring)",
    },
  },
} satisfies Meta<typeof ShutterButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Manual mode — no countdown ring */
export const Manual: Story = {};

/** Auto mode, no steady page yet */
export const AutoWaiting: Story = { args: { progress: 0 } };

/** Auto mode, page held steady part of the way */
export const AutoCountingDown: Story = { args: { progress: 0.6 } };

export const Disabled: Story = { args: { disabled: true } };
