import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Suggestion } from "@/lib/search/detect-suggestions";
import { SuggestionDropdown } from "./suggestion-dropdown";

const suggestions: Suggestion[] = [
  { facet: "tag", value: "book", start: 0, end: 4 },
  { facet: "object", value: "book", start: 0, end: 4 },
];

function renderDropdown() {
  const onApply = vi.fn();
  const anchorRef = createRef<HTMLInputElement>();
  render(
    <>
      <input ref={anchorRef} aria-label="Search" />
      <SuggestionDropdown
        open
        suggestions={suggestions}
        onApply={onApply}
        anchorRef={anchorRef}
      />
    </>,
  );
  return { onApply };
}

// Radix positions the tooltip with ResizeObserver, which jsdom lacks
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", NoopResizeObserver);
});

describe("SuggestionDropdown", () => {
  it("opens chip tooltips to the left so they don't cover the chip below", async () => {
    renderDropdown();
    const firstIcon = document.querySelector<HTMLElement>(
      "[data-slot=tooltip-trigger]",
    );
    if (!firstIcon) throw new Error("suggestion chip icon not rendered");
    await userEvent.setup().hover(firstIcon);
    await screen.findByRole("tooltip");
    expect(
      document.querySelector("[data-slot=tooltip-content]"),
    ).toHaveAttribute("data-side", "left");
  });

  it("applies a suggestion on pointerdown, and prevents default to keep focus", () => {
    const { onApply } = renderDropdown();
    const [first] = screen.getAllByRole("button");
    // pointerdown (not mousedown) so the tap registers on touch. fireEvent
    // returns false when a handler called preventDefault — asserting that
    // locks in the focus-retention that keeps the input focused and the
    // dropdown mounted on a real tap (without it, the mobile drop regresses)
    const notCancelled = fireEvent.pointerDown(first);
    expect(onApply).toHaveBeenCalledWith(suggestions[0]);
    expect(notCancelled).toBe(false);
  });

  it("applies the specific suggestion that was tapped", () => {
    const { onApply } = renderDropdown();
    const buttons = screen.getAllByRole("button");
    fireEvent.pointerDown(buttons[1]);
    expect(onApply).toHaveBeenCalledWith(suggestions[1]);
  });

  it("renders nothing when closed", () => {
    const anchorRef = createRef<HTMLInputElement>();
    render(
      <SuggestionDropdown
        open={false}
        suggestions={suggestions}
        onApply={vi.fn()}
        anchorRef={anchorRef}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
