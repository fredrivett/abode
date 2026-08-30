import type { Meta, StoryObj } from "@storybook/nextjs";
import { TreeIndent } from "./tree-indent";

const meta = {
  title: "UI/TreeIndent",
  component: TreeIndent,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof TreeIndent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single connector at one depth. */
export const Single: Story = {
  args: { depth: 1 },
};

/** How a nested pipeline reads when each row pairs TreeIndent with a label. */
const rows: { depth: number; label: string }[] = [
  { depth: 0, label: "classify-url" },
  { depth: 1, label: "analyze-media-cover" },
  { depth: 2, label: "enrich-item" },
  { depth: 3, label: "sync-item-to-rooms" },
  { depth: 0, label: "classify-url (retry)" },
];

export const NestedRows: Story = {
  args: { depth: 0 },
  render: () => (
    <div className="font-mono text-xs">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center py-1">
          <TreeIndent depth={row.depth} />
          {row.label}
        </div>
      ))}
    </div>
  ),
};
