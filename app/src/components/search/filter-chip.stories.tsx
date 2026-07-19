import type { Meta, StoryObj } from "@storybook/nextjs";
import type { Filter } from "@/lib/search/types";
import { FilterChip } from "./filter-chip";

const filter = (
  over: Partial<Filter> & Pick<Filter, "type" | "value">,
): Filter => ({
  id: `${over.type}:${over.value}`,
  negated: false,
  ...over,
});

const meta = {
  title: "Search/FilterChip",
  component: FilterChip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FilterChip>;

export default meta;
type Story = StoryObj<typeof meta>;

// One story per facet — emoji + accent colour identify it (no text label);
// colour is the special case that shows a swatch circle instead of an emoji.
export const Type: Story = {
  args: { filter: filter({ type: "type", value: "article" }) },
};
export const Tag: Story = {
  args: { filter: filter({ type: "tag", value: "landscape" }) },
};
export const ObjectFacet: Story = {
  name: "Object",
  args: { filter: filter({ type: "object", value: "tree" }) },
};
export const Color: Story = {
  args: { filter: filter({ type: "color", value: "orange" }) },
};
export const ColorHex: Story = {
  args: { filter: filter({ type: "color", value: "#FF5733" }) },
};
export const Source: Story = {
  args: { filter: filter({ type: "source", value: "instagram" }) },
};
export const DateFacet: Story = {
  name: "Date",
  args: { filter: filter({ type: "date", value: "2026-06-15" }) },
};
export const Location: Story = {
  args: { filter: filter({ type: "location", value: "paris" }) },
};

export const WithRemove: Story = {
  args: {
    filter: filter({ type: "location", value: "paris" }),
    onRemove: () => {},
  },
};

export const Negated: Story = {
  args: { filter: filter({ type: "tag", value: "landscape", negated: true }) },
};

export const NoneValue: Story = {
  args: { filter: filter({ type: "location", value: "(none)" }) },
};

// Date ranges collapse to the simplest label that exactly covers the span.
export const DateWholeMonth: Story = {
  name: "Date · whole month → 'June 2026'",
  args: {
    filter: filter({
      type: "date",
      value: "2026-06-01",
      dateOperator: "between",
      endDate: "2026-06-30",
    }),
  },
};

export const DateWholeYear: Story = {
  name: "Date · whole year → '2026'",
  args: {
    filter: filter({
      type: "date",
      value: "2026-01-01",
      dateOperator: "between",
      endDate: "2026-12-31",
    }),
  },
};

export const DatePartialRange: Story = {
  name: "Date · partial range (no collapse)",
  args: {
    filter: filter({
      type: "date",
      value: "2026-06-05",
      dateOperator: "between",
      endDate: "2026-06-20",
    }),
  },
};

export const AllFacets: Story = {
  args: { filter: filter({ type: "type", value: "article" }) },
  render: () => (
    <div className="flex max-w-md flex-wrap gap-1.5">
      <FilterChip filter={filter({ type: "type", value: "article" })} />
      <FilterChip filter={filter({ type: "tag", value: "landscape" })} />
      <FilterChip filter={filter({ type: "object", value: "tree" })} />
      <FilterChip filter={filter({ type: "color", value: "orange" })} />
      <FilterChip filter={filter({ type: "source", value: "instagram" })} />
      <FilterChip filter={filter({ type: "date", value: "2026-06-15" })} />
      <FilterChip filter={filter({ type: "location", value: "paris" })} />
    </div>
  ),
};
