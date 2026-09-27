import type { Meta, StoryObj } from "@storybook/nextjs";
import { ScannerReview } from "./scanner-review";
import { samplePages } from "./scanner-review.fixtures";

const three = samplePages(3);
const noop = () => {};

const meta = {
  title: "Scanner/ScannerReview",
  component: ScannerReview,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-[760px] w-[390px]">
        <Story />
      </div>
    ),
  ],
  args: {
    pages: three.pages,
    previews: three.previews,
    activeId: three.pages[0].id,
    flight: null,
    saving: false,
    onActiveChange: noop,
    onFlightEnd: noop,
    onAddPage: noop,
    onRetake: noop,
    onDelete: noop,
    onRotate: noop,
    onFilterChange: noop,
    onMove: noop,
    onCancel: noop,
    onSave: noop,
  },
} satisfies Meta<typeof ScannerReview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Several scanned pages, first one active */
export const MultiplePages: Story = {};

export const SinglePage: Story = {
  args: (() => {
    const one = samplePages(1);
    return {
      pages: one.pages,
      previews: one.previews,
      activeId: one.pages[0].id,
    };
  })(),
};

/** A page whose preview is still rendering */
export const Rendering: Story = { args: { previews: new Map() } };

export const Saving: Story = { args: { saving: true } };
