import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FILTER_TYPES, type Filter } from "@/lib/search/types";
import { FilterChip } from "./filter-chip";

// Radix positions the tooltip with ResizeObserver, which jsdom lacks
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", NoopResizeObserver);
});

const tagFilter: Filter = {
  id: "1",
  type: "tag",
  value: "book",
  negated: false,
};

async function hoverIcon(container: HTMLElement) {
  const icon = container.querySelector<HTMLElement>(
    "[data-slot=tooltip-trigger]",
  );
  if (!icon) throw new Error("facet icon not rendered");
  await userEvent.setup().hover(icon);
  await screen.findByRole("tooltip");
  return document.querySelector("[data-slot=tooltip-content]");
}

describe("FilterChip", () => {
  it("shows the facet name in a tooltip when hovering the emoji", async () => {
    const filter: Filter = {
      id: "1",
      type: "type",
      value: "twitter",
      negated: false,
    };
    render(<FilterChip filter={filter} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.setup().hover(screen.getByText(FILTER_TYPES.type.icon));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      `${FILTER_TYPES.type.icon} Type`,
    );
  });

  it("shows the facet name in a tooltip when hovering the colour swatch", async () => {
    const filter: Filter = {
      id: "1",
      type: "color",
      value: "#ff0000",
      negated: false,
    };
    const { container } = render(<FilterChip filter={filter} />);

    await hoverIcon(container);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      `${FILTER_TYPES.color.icon} Color`,
    );
  });

  it("opens the tooltip below the chip by default", async () => {
    const { container } = render(<FilterChip filter={tagFilter} />);
    const tooltip = await hoverIcon(container);
    expect(tooltip).toHaveAttribute("data-side", "bottom");
  });

  it("opens the tooltip on the requested side", async () => {
    const { container } = render(
      <FilterChip filter={tagFilter} tooltipSide="left" />,
    );
    const tooltip = await hoverIcon(container);
    expect(tooltip).toHaveAttribute("data-side", "left");
  });
});
