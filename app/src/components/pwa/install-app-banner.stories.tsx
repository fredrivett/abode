import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { InstallAppBannerView } from "./install-app-banner";

const meta = {
  title: "PWA/InstallAppBanner",
  component: InstallAppBannerView,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { onInstall: fn(), onDismiss: fn() },
} satisfies Meta<typeof InstallAppBannerView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Android Chrome: the browser handed us its native install prompt */
export const NativePrompt: Story = { args: { option: "prompt" } };

/** iOS: no prompt API, so the Share → Add to Home Screen steps */
export const Ios: Story = { args: { option: "ios" } };
