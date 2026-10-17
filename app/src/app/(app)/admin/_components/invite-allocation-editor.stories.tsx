import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";
import { InviteAllocationEditor } from "./invite-allocation-editor";

// Stands in for the server action, keeping the user's used count fixed
function mockSave(used: number) {
  return fn(async ({ allocation }: { allocation: number }) => ({
    success: true as const,
    usage: { allocation, used, available: Math.max(0, allocation - used) },
  }));
}

// Admin user page: a user's invites, with an inline allocation editor
const meta = {
  title: "Admin/InviteAllocationEditor",
  component: InviteAllocationEditor,
  tags: ["autodocs"],
  args: {
    userId: "user-1",
    initialUsage: { allocation: 3, used: 2, available: 1 },
    saveAllocation: mockSave(2),
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
  args: {
    initialUsage: { allocation: 3, used: 3, available: 0 },
    saveAllocation: mockSave(3),
  },
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
