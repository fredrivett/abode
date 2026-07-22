import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { FiltersResponse } from "@/lib/search/api";
import type { SearchState } from "@/lib/search/types";
import { SearchInput } from "./search-input";

const FILTER_OPTIONS: FiltersResponse = {
  location: ["paris", "new york"],
  color: ["orange", "teal"],
  type: ["article", "image"],
  tag: ["typography", "orange"],
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
  // Tab applies the first suggestion (location: paris), removing it from the query.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");
    await userEvent.click(input);
    await userEvent.keyboard("{Tab}");
    await waitFor(() => {
      expect(input).toHaveValue("june 2026");
      expect(canvas.getByText("paris")).toBeInTheDocument();
    });
  },
};

// "orange" is both a colour and a tag → both are offered.
export const AmbiguousMatch: Story = {
  render: () => (
    <StatefulSearchInput initialQuery="orange" filterOptions={FILTER_OPTIONS} />
  ),
  // Colour is the default; ArrowDown selects the tag, and Tab applies that one.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{Tab}");
    await waitFor(() => {
      expect(input).toHaveValue("");
      // the applied chip is the tag (its screen-reader label), not the colour
      expect(canvas.getByText("Tag:")).toBeInTheDocument();
    });
  },
};

// No filterOptions passed → suggestions are off, plain text only.
export const NoSuggestions: Story = {
  render: () => <StatefulSearchInput initialQuery="paris june 2026" />,
};
