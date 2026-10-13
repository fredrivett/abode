import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HighlightableArticle } from "./highlightable-article";

const mutateAsync = vi.fn();
vi.mock("@/lib/highlights/use-highlights", () => ({
  useItemHighlights: () => ({ data: [] }),
  useCreateHighlight: () => ({ mutateAsync, isPending: false }),
  useDeleteHighlight: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("./tweet-embed", () => ({ TweetEmbed: () => null }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CONTENT = "The quick brown fox jumps over the lazy dog.";

function renderArticle() {
  render(<HighlightableArticle itemId="item-1" content={CONTENT} />);
  return screen.getByText(CONTENT);
}

/** Selects `text` inside `el`, as a long-press or drag-select would */
function selectText(el: HTMLElement, text: string) {
  const textNode = el.firstChild;
  if (!textNode) throw new Error("element has no text node");
  const start = CONTENT.indexOf(text);
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, start + text.length);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

function clearSelection() {
  window.getSelection()?.removeAllRanges();
  document.dispatchEvent(new Event("selectionchange"));
}

const settle = () => act(() => vi.advanceTimersByTime(1000));
const highlightButton = () =>
  screen.queryByRole("button", { name: "Highlight" });

describe("HighlightableArticle selection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({});
    // jsdom has no layout, so Range lacks getBoundingClientRect
    Range.prototype.getBoundingClientRect = () => new DOMRect(10, 20, 100, 16);
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    vi.useRealTimers();
  });

  it("offers to highlight a touch selection once it settles (no mouseup)", () => {
    const paragraph = renderArticle();
    fireEvent.pointerDown(paragraph, { pointerType: "touch" });
    selectText(paragraph, "brown fox");

    expect(highlightButton()).not.toBeInTheDocument();
    settle();
    expect(highlightButton()).toBeInTheDocument();
  });

  it("waits for mouse release before showing the popover", () => {
    const paragraph = renderArticle();
    fireEvent.pointerDown(paragraph, { pointerType: "mouse" });
    selectText(paragraph, "brown fox");
    settle();
    expect(highlightButton()).not.toBeInTheDocument();

    fireEvent.pointerUp(document, { pointerType: "mouse" });
    expect(highlightButton()).toBeInTheDocument();
  });

  it("ignores selections shorter than three characters", () => {
    const paragraph = renderArticle();
    selectText(paragraph, "fo");
    settle();
    expect(highlightButton()).not.toBeInTheDocument();
  });

  it("closes the popover when the selection is cleared", () => {
    const paragraph = renderArticle();
    selectText(paragraph, "brown fox");
    settle();
    expect(highlightButton()).toBeInTheDocument();

    clearSelection();
    settle();
    expect(highlightButton()).not.toBeInTheDocument();
  });

  it("creates the highlight even if tapping the button collapses the selection", async () => {
    const paragraph = renderArticle();
    fireEvent.pointerDown(paragraph, { pointerType: "touch" });
    selectText(paragraph, "brown fox");
    settle();

    const button = highlightButton();
    if (!button) throw new Error("expected the Highlight button");
    fireEvent.pointerDown(button, { pointerType: "touch" });
    // iOS drops the text selection when the tap starts
    clearSelection();
    settle();
    expect(highlightButton()).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(button);
    });
    const start = CONTENT.indexOf("brown fox");
    expect(mutateAsync).toHaveBeenCalledWith({
      startOffset: start,
      endOffset: start + "brown fox".length,
      text: "brown fox",
    });
  });
});
