import { fireEvent, render, screen } from "@testing-library/react";
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
