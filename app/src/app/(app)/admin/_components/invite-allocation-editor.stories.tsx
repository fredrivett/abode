import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";
import { InviteAllocationEditor } from "./invite-allocation-editor";

// Admin user page: a user's invites, with an inline allocation editor
const meta = {
  title: "Admin/InviteAllocationEditor",
  component: InviteAllocationEditor,
  tags: ["autodocs"],
  args: {
    userId: "user-1",
    initialUsage: { allocation: 3, used: 2, available: 1 },
    saveAllocation: fn(async ({ allocation }: { allocation: number }) => ({
      success: true as const,
      usage: {
        allocation,
        used: 2,
        available: Math.max(0, allocation - 2),
      },
    })),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InviteAllocationEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllUsed: Story = {
  args: { initialUsage: { allocation: 3, used: 3, available: 0 } },
};

export const Editing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit invites" }));
    const input = canvas.getByLabelText("Invites");
    await userEvent.clear(input);
    await userEvent.type(input, "1");
    // Below what's used: the editor explains the effect
    await expect(canvas.getByText(/they'll have none left/)).toBeVisible();
  },
};
