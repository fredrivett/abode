import type { Meta, StoryObj } from "@storybook/nextjs";
import { DocumentPages } from "./document-pages";

// Inline SVG pages so the story renders offline
const pageSvg = (lines: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="594"><rect width="420" height="594" fill="#fff"/>${Array.from(
      { length: lines },
      (_, i) =>
        `<rect x="40" y="${60 + i * 28}" width="${200 + ((i * 37) % 120)}" height="10" fill="#111"/>`,
    ).join("")}</svg>`,
  )}`;

const meta = {
  title: "Document/DocumentPages",
  component: DocumentPages,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-[700px] bg-gray-900">
        <Story />
      </div>
    ),
  ],
  args: {
    pages: null,
    pageCount: 3,
    coverUrl: pageSvg(10),
    status: "loading",
    title: "Scanned document",
  },
} satisfies Meta<typeof DocumentPages>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Cover shown while the page list loads */
export const Loading: Story = {};

/** The pages failed to load — the cover stays */
export const LoadFailed: Story = { args: { status: "error" } };

/** A long scanned PDF past the OCR cap: its owner is told which pages search can't find */
export const PagesNotSearchable: Story = {
  args: {
    status: "error",
    pageCount: 42,
    ocrSkippedPages: 12,
  },
};
