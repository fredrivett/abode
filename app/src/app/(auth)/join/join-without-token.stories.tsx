import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { JoinWithoutToken } from "./join-without-token";

const meta = {
  title: "Auth/JoinWithoutToken",
  component: JoinWithoutToken,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <div className="flex justify-center p-16">
        <div className="w-full max-w-sm space-y-6 px-4">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof JoinWithoutToken>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InvalidLink: Story = {
  name: "Pasted something that isn't an invite link",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText("invite link"),
      "someone@example.com",
    );
    await userEvent.click(canvas.getByRole("button", { name: "continue" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "that doesn't look like an invite link",
    );
  },
};
