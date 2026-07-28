import type { Meta, StoryObj } from "@storybook/react";

import { Table, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "./sortable-table-head";

const meta = {
  title: "UI/SortableTableHead",
  component: SortableTableHead,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <Table>
        <TableHeader>
          <TableRow>
            <Story />
          </TableRow>
        </TableHeader>
      </Table>
    ),
  ],
  args: {
    column: "items",
    children: "Items",
  },
} satisfies Meta<typeof SortableTableHead>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unsorted: Story = {};

export const Ascending: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { query: { sort: "items", dir: "asc" } },
    },
  },
};

export const Descending: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { query: { sort: "items", dir: "desc" } },
    },
  },
};

export const RightAligned: Story = {
  args: {
    align: "right",
    className: "text-right",
  },
};
