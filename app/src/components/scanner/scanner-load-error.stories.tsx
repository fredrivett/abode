import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { ScannerLoadError } from "./scanner-load-error";

const meta = {
  title: "Scanner/ScannerLoadError",
  component: ScannerLoadError,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { onRetry: fn(), onClose: fn() },
} satisfies Meta<typeof ScannerLoadError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
