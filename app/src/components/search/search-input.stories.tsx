import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import type { FiltersResponse } from "@/lib/search/api";
import type { SearchState } from "@/lib/search/types";
import { SearchInput } from "./search-input";

const FILTER_OPTIONS: FiltersResponse = {
  location: ["paris", "new york"],
  color: ["orange", "teal"],
  type: ["article", "image"],
  tag: ["typography"],
};

function StatefulSearchInput({
  initialQuery = "",
  filterOptions,
}: {
  initialQuery?: string;
  filterOptions?: FiltersResponse;
}) {
  const [state, setState] = useState<SearchState>({
    query: initialQuery,
    filters: [],
  });
  return (
    <div className="w-[36rem] max-w-full">
      <SearchInput
        value={state}
        onChange={setState}
        filterOptions={filterOptions}
        placeholder="Find..."
      />
    </div>
  );
}

const meta = {
  title: "Search/SearchInput",
  component: SearchInput,
  parameters: { layout: "centered" },
  // render-based stories manage their own state; these satisfy the required props
  args: { value: { query: "", filters: [] }, onChange: () => {} },
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => <StatefulSearchInput filterOptions={FILTER_OPTIONS} />,
};

// Free-text that resolves to a grounded location + a parsed date.
export const WithSuggestions: Story = {
  render: () => (
    <StatefulSearchInput
      initialQuery="paris june 2026"
      filterOptions={FILTER_OPTIONS}
    />
  ),
};

// No filterOptions passed → suggestions are off, plain text only.
export const NoSuggestions: Story = {
  render: () => <StatefulSearchInput initialQuery="paris june 2026" />,
};
