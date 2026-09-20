import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
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

describe("SuggestionDropdown", () => {
  it("applies a suggestion on pointerdown (works on touch, not just mouse)", () => {
    const { onApply } = renderDropdown();
    // pointerdown fires for both mouse and touch and runs before the input
    // blurs — mousedown alone dropped taps on mobile once the dropdown
    // unmounted on blur
    const [first] = screen.getAllByRole("button");
    fireEvent.pointerDown(first);
    expect(onApply).toHaveBeenCalledWith(suggestions[0]);
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
