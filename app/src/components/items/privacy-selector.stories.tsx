import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { PrivacySelector } from "./privacy-selector";

const meta = {
  title: "Items/PrivacySelector",
  component: PrivacySelector,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { onChange: fn() },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PrivacySelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = { args: { value: "standard" } };

export const Unlisted: Story = { args: { value: "unlisted" } };

export const Sensitive: Story = { args: { value: "sensitive" } };

export const Saving: Story = { args: { value: "unlisted", disabled: true } };
