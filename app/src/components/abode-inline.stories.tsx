import type { Meta, StoryObj } from "@storybook/nextjs";
import { AbodeInline } from "./abode-inline";

const meta = {
  title: "Brand/AbodeInline",
  component: AbodeInline,
  tags: ["autodocs"],
} satisfies Meta<typeof AbodeInline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InText: Story = {
  render: () => (
    <p className="text-muted-foreground">
      welcome to <AbodeInline /> — the home for your info.
    </p>
  ),
};

export const InHeading: Story = {
  render: () => (
    <h1 className="font-serif text-6xl tracking-tight">
      <AbodeInline className="ml-0" /> vs mymind
    </h1>
  ),
};

export const InLabel: Story = {
  render: () => (
    <p className="font-medium text-sm">
      <AbodeInline className="ml-0" />
    </p>
  ),
};
