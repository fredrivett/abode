import type { Meta, StoryObj } from "@storybook/nextjs";
import { AccountStats } from "./account-stats";

const meta = {
  title: "Settings/AccountStats",
  component: AccountStats,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: {
    itemCount: 664,
    fileCount: 823,
    storageUsedBytes: BigInt(856_686_592),
  },
} satisfies Meta<typeof AccountStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { itemCount: 0, fileCount: 0, storageUsedBytes: BigInt(0) },
};

export const FileCountUnavailable: Story = {
  args: { fileCount: null },
};
