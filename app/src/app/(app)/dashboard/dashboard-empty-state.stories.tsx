import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { DashboardEmptyStateView } from "./dashboard-empty-state";

const meta = {
  title: "Dashboard/DashboardEmptyState",
  component: DashboardEmptyStateView,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    isUploading: false,
    onFileSelected: fn(),
    onPasteLink: fn(),
    onActionClick: fn(),
  },
} satisfies Meta<typeof DashboardEmptyStateView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop: the drag-and-drop/paste hint shows with a fine pointer */
export const Default: Story = {};

/** A picked file is uploading: the button shows progress, both are disabled */
export const Uploading: Story = {
  args: { isUploading: true },
};

/** Phone width: the actions stack full-width */
export const Mobile: Story = {
  decorators: [
    (Story) => (
      <div className="w-[390px]">
        <Story />
      </div>
    ),
  ],
};
