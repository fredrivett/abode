import type { Meta, StoryObj } from "@storybook/nextjs";
import { StepRail } from "./step-rail";

const meta = {
  title: "Marketing/StepRail",
  component: StepRail,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    active: {
      control: "boolean",
      description: "Active step renders a filling pill; inactive renders a dot",
    },
    progress: {
      control: { type: "range", min: 0, max: 1, step: 0.01 },
      description: "0→1 scroll progress through the active step's band",
    },
  },
  // The rail stretches to its row's height — give it one so the pill has room.
  decorators: [
    (Story) => (
      <div className="flex h-24 items-stretch">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StepRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { active: false, progress: 0 },
};

// Freshly active — floored at the 10% minimum so it reads as a pill.
export const ActiveEmpty: Story = {
  args: { active: true, progress: 0 },
};

export const ActiveHalf: Story = {
  args: { active: true, progress: 0.5 },
};

export const ActiveFull: Story = {
  args: { active: true, progress: 1 },
};
