import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HighlightsPanel } from "./highlights-panel";

const HIGHLIGHT = {
  id: "hl-1",
  startOffset: 0,
  endOffset: 10,
  text: "Less, but better.",
  note: null,
  createdAt: new Date("2026-10-01T09:00:00.000Z"),
};

vi.mock("@/lib/highlights/use-highlights", () => ({
  useItemHighlights: () => ({ data: [HIGHLIGHT], isLoading: false }),
  useDeleteHighlight: () => ({ mutate: vi.fn() }),
}));

// The accordion starts collapsed; open it to reach the highlight cards
function renderOpen(props: Partial<Parameters<typeof HighlightsPanel>[0]>) {
  render(<HighlightsPanel itemId="item-1" {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /Highlights \(1\)/ }));
}

describe("HighlightsPanel sharing", () => {
  it("shares the highlight without also jumping to it", () => {
    const onShareHighlight = vi.fn();
    const onHighlightClick = vi.fn();
    renderOpen({ onShareHighlight, onHighlightClick });

    fireEvent.click(screen.getByRole("button", { name: "Share highlight" }));

    expect(onShareHighlight).toHaveBeenCalledWith({
      id: "hl-1",
      text: "Less, but better.",
    });
    expect(onHighlightClick).not.toHaveBeenCalled();
  });

  it("shows no share button when sharing isn't offered", () => {
    renderOpen({});
    expect(
      screen.queryByRole("button", { name: "Share highlight" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete highlight" }),
    ).toBeInTheDocument();
  });

  it("hides the share button while a delete is awaiting confirmation", () => {
    renderOpen({ onShareHighlight: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: "Delete highlight" }));

    expect(screen.getByText("Confirm?")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Share highlight" }),
    ).not.toBeInTheDocument();
  });
});
