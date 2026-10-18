import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { ApiClientError } from "@/lib/api-client";
import { SensitiveUnlockDialog } from "./sensitive-unlock-dialog";

const meta = {
  title: "Items/SensitiveUnlockDialog",
  component: SensitiveUnlockDialog,
  tags: ["autodocs"],
  args: { open: true, onUnlocked: fn(), onCancel: fn() },
} satisfies Meta<typeof SensitiveUnlockDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { unlock: async () => ({ unlocked: true }) },
};

async function submitPassword() {
  const dialog = within(await screen.findByRole("dialog"));
  await userEvent.type(dialog.getByPlaceholderText("Password"), "hunter2");
  await userEvent.click(dialog.getByRole("button", { name: "Open" }));
  return dialog;
}

export const WrongPassword: Story = {
  args: {
    unlock: async () => {
      throw new ApiClientError({
        message: "Incorrect password",
        status: 403,
        code: "incorrect_password",
      });
    },
  },
  play: async () => {
    const dialog = await submitPassword();
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Incorrect password",
    );
  },
};

export const Checking: Story = {
  args: { unlock: () => new Promise(() => {}) },
  play: async () => {
    const dialog = await submitPassword();
    await expect(dialog.getByPlaceholderText("Password")).toBeDisabled();
  },
};
