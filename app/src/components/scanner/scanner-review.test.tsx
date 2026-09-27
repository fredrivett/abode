import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScannerReview } from "./scanner-review";
import { samplePages } from "./scanner-review.fixtures";

// jsdom has no layout engine: report a fixed carousel size
class FixedResizeObserver {
  constructor(
    private readonly callback: (
      entries: { contentRect: { width: number; height: number } }[],
    ) => void,
  ) {}
  observe() {
    this.callback([{ contentRect: { width: 390, height: 600 } }]);
  }
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FixedResizeObserver);
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

function renderReview(
  overrides: Partial<Parameters<typeof ScannerReview>[0]> = {},
) {
  const { pages, previews } = samplePages(3);
  const handlers = {
    onActiveChange: vi.fn(),
    onFlightEnd: vi.fn(),
    onAddPage: vi.fn(),
    onRetake: vi.fn(),
    onDelete: vi.fn(),
    onRotate: vi.fn(),
    onFilterChange: vi.fn(),
    onMove: vi.fn(),
    onCancel: vi.fn(),
    onSave: vi.fn(),
  };
  render(
    <ScannerReview
      pages={pages}
      previews={previews}
      activeId={pages[1].id}
      flight={null}
      saving={false}
      {...handlers}
      {...overrides}
    />,
  );
  return { pages, handlers };
}

describe("ScannerReview", () => {
  it("shows which page is active", () => {
    renderReview();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByAltText("Page 2")).toBeInTheDocument();
  });

  it("marks the active page's filter and changes it", () => {
    const { pages, handlers } = renderReview();
    expect(screen.getByRole("button", { name: "B&W" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Greyscale" }));
    expect(handlers.onFilterChange).toHaveBeenCalledWith({
      id: pages[1].id,
      filter: "grey",
    });
  });

  it.each([
    ["Rotate", "onRotate"],
    ["Retake", "onRetake"],
    ["Delete", "onDelete"],
  ] as const)("%s acts on the active page", (label, handler) => {
    const { pages, handlers } = renderReview();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(handlers[handler]).toHaveBeenCalledWith(pages[1].id);
  });

  it("adds a page, cancels and saves", () => {
    const { handlers } = renderReview();
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(handlers.onAddPage).toHaveBeenCalled();
    expect(handlers.onCancel).toHaveBeenCalled();
    expect(handlers.onSave).toHaveBeenCalled();
  });

  it("disables saving while a save is in flight", () => {
    renderReview({ saving: true });
    expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
  });

  it("reorders pages in arrange mode, without moving past either end", () => {
    const { pages, handlers } = renderReview();
    fireEvent.click(screen.getByRole("button", { name: "Arrange" }));

    expect(
      screen.getByRole("button", { name: "Move page 1 earlier" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move page 3 later" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Move page 1 later" }));
    expect(handlers.onMove).toHaveBeenCalledWith({ id: pages[0].id, to: 1 });
  });

  it("opens a page from arrange mode back in edit mode", () => {
    const { pages, handlers } = renderReview();
    fireEvent.click(screen.getByRole("button", { name: "Arrange" }));
    fireEvent.click(screen.getByRole("button", { name: "Open page 3" }));
    expect(handlers.onActiveChange).toHaveBeenCalledWith(pages[2].id);
    expect(screen.getByRole("button", { name: "Rotate" })).toBeInTheDocument();
  });
});
