import type { Meta, StoryObj } from "@storybook/nextjs";
import { OfflineBannerView } from "./offline-banner";

const meta = {
  title: "PWA/OfflineBanner",
  component: OfflineBannerView,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof OfflineBannerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
