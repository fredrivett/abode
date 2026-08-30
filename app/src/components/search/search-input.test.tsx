import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Filter, SearchState } from "@/lib/search/types";
import { SearchInput } from "./search-input";

const filters: Filter[] = [
  { id: "1", type: "location", value: "Brazil", negated: false },
];

function renderInput(value: SearchState) {
  const onChange = vi.fn();
  render(<SearchInput value={value} onChange={onChange} />);
  return { onChange, input: screen.getByRole("textbox", { name: "Search" }) };
}

describe("SearchInput escape key", () => {
  it("clears query and filters when there's something to clear", () => {
    const { onChange, input } = renderInput({ query: "beach", filters });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith({ query: "", filters: [] });
  });

  it("clears when only filters are present", () => {
    const { onChange, input } = renderInput({ query: "", filters });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith({ query: "", filters: [] });
  });

  it("blurs instead of clearing when the search is empty", () => {
    const { onChange, input } = renderInput({ query: "", filters: [] });
    input.focus();
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).not.toHaveFocus();
  });

  it("closes an open filter dropdown instead of clearing everything", () => {
    // Trailing `@` opens the filter-type dropdown
    const { onChange, input } = renderInput({ query: "beach @", filters });
    fireEvent.keyDown(input, { key: "Escape" });
    // Strips the incomplete `@` but keeps the query text and filters
    expect(onChange).toHaveBeenCalledWith({ query: "beach", filters });
  });

  it("closes an open date picker instead of clearing everything", () => {
    // `@date:` opens the date picker (separate from the filter dropdown)
    const { onChange, input } = renderInput({ query: "beach @date:", filters });
    fireEvent.keyDown(input, { key: "Escape" });
    // Strips the incomplete `@date:` but keeps the query text and filters
    expect(onChange).toHaveBeenCalledWith({ query: "beach", filters });
  });
});

function renderGlobal(value: SearchState, extra?: ReactNode) {
  const onChange = vi.fn();
  render(
    <>
      {extra}
      <SearchInput value={value} onChange={onChange} focusShortcut />
    </>,
  );
  return { onChange };
}

describe("SearchInput global escape (focusShortcut)", () => {
  it("clears the search when the input is not focused", () => {
    const { onChange } = renderGlobal({ query: "beach", filters });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith({ query: "", filters: [] });
  });

  it("does nothing when there's nothing to clear", () => {
    const { onChange } = renderGlobal({ query: "", filters: [] });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not clear when a higher-priority handler consumes Escape", () => {
    const { onChange } = renderGlobal({ query: "beach", filters });
    // Mimics Radix's DismissableLayer: a capture-phase listener that runs
    // before ours and preventDefaults when it closes the topmost overlay
    const consume = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    document.addEventListener("keydown", consume, { capture: true });
    fireEvent.keyDown(document.body, { key: "Escape" });
    document.removeEventListener("keydown", consume, { capture: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not clear while another editable field is focused", () => {
    const { onChange } = renderGlobal(
      { query: "beach", filters },
      <input aria-label="other field" />,
    );
    screen.getByLabelText("other field").focus();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
