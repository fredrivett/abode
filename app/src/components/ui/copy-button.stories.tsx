import type { Meta, StoryObj } from "@storybook/nextjs";

import { Button } from "@/components/ui/button";
import {
  CopyButton,
  CopyStatusIcon,
  copyStatusLabel,
} from "@/components/ui/copy-button";
import type { CopyStatus } from "@/hooks/use-copy-to-clipboard";

const meta: Meta<typeof CopyButton> = {
  title: "UI/CopyButton",
  component: CopyButton,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    text: "https://example.com/article",
    label: "Copy URL",
  },
};

export default meta;

type Story = StoryObj<typeof CopyButton>;

export const Default: Story = {};

export const Small: Story = {
  args: { size: "icon-sm", iconClassName: "size-3.5" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

const STATUSES: CopyStatus[] = ["idle", "copying", "copied", "failed"];

/** Each stage side by side: idle, awaiting the browser, landed, failed */
export const States: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      {STATUSES.map((status) => (
        <Button
          key={status}
          variant="outline"
          size="icon"
          aria-label={copyStatusLabel({ status, label: "Copy URL" })}
        >
          <CopyStatusIcon status={status} />
        </Button>
      ))}
    </div>
  ),
};
