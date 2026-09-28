import type { Meta, StoryObj } from "@storybook/nextjs";
import { ScannerLoadError } from "./scanner-entry";

const meta = {
  title: "Scanner/ScannerLoadError",
  component: ScannerLoadError,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { onRetry: () => {}, onClose: () => {} },
} satisfies Meta<typeof ScannerLoadError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
