import type { Meta, StoryObj } from "@storybook/nextjs";
import { Img } from "./img";

const meta = {
  title: "UI/Img",
  component: Img,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    alt: "A car on a colourful street",
    className: "w-72 rounded-lg object-cover",
  },
} satisfies Meta<typeof Img>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { src: "/gallery/bo-kaap-car.jpg" },
};

/** A same-origin 404: retried with backoff, then left as a broken image */
export const FailingSource: Story = {
  args: { src: "/gallery/does-not-exist.jpg" },
};
