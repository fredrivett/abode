import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { NoteLinkMenuPanel } from "@/components/note/note-link-menu-panel";

const meta = {
  title: "Note/NoteLinkMenuPanel",
  component: NoteLinkMenuPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    href: "https://www.example.com/articles/how-to-take-notes",
    onOpen: fn(),
    onCopy: fn(async () => true),
    onSave: fn(),
    onRemove: fn(),
    onCancelEdit: fn(),
    onEditBlur: fn(),
  },
} satisfies Meta<typeof NoteLinkMenuPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongUrl: Story = {
  args: {
    href: "https://www.example.com/a/very/long/path/that/keeps/going/and/going?utm_source=newsletter&utm_medium=email",
  },
};

export const Email: Story = {
  args: { href: "mailto:hello@example.com" },
};

// A stored href that isn't safe to open (e.g. `javascript:`) can still be
// edited or removed, but not opened
export const UnsafeHref: Story = {
  args: { href: "javascript:alert(1)" },
};

export const Editing: Story = {
  args: { defaultEditing: true },
};
