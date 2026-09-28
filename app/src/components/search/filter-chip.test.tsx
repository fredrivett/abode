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

    const swatch = container.querySelector<HTMLElement>(
      "[data-slot=tooltip-trigger]",
    );
    if (!swatch) throw new Error("swatch not rendered");
    await userEvent.setup().hover(swatch);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      `${FILTER_TYPES.color.icon} Color`,
    );
  });
});
