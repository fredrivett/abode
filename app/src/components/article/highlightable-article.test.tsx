import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { HighlightableArticle } from "./highlightable-article";

const mutateAsync = vi.fn();
vi.mock("@/lib/highlights/use-highlights", () => ({
  useItemHighlights: () => ({ data: [] }),
  useCreateHighlight: () => ({ mutateAsync, isPending: false }),
  useDeleteHighlight: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("./tweet-embed", () => ({ TweetEmbed: () => null }));

const CONTENT = "First paragraph of text.\n\nSecond paragraph of text.";

beforeAll(() => {
  // jsdom has no layout engine: stub what Radix's popper and the anchor need
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 10, 10);
});

function selectText({
  startNode,
  startOffset,
  endNode,
  endOffset,
}: {
  startNode: Node;
  startOffset: number;
  endNode: Node;
  endOffset: number;
}) {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function releaseMouse(target: Element) {
  fireEvent.mouseUp(target);
  act(() => {
    vi.runAllTimers();
  });
}

describe("HighlightableArticle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({});
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    vi.useRealTimers();
  });

  it("shows the Highlight button for a selection released inside the text", () => {
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    const text = screen.getByText("First paragraph of text.").firstChild;
    if (!text) throw new Error("missing text node");

    selectText({
      startNode: text,
      startOffset: 0,
      endNode: text,
      endOffset: 5,
    });
    releaseMouse(screen.getByText("First paragraph of text."));

    expect(
      screen.getByRole("button", { name: "Highlight" }),
    ).toBeInTheDocument();
  });

  it("shows the Highlight button when the drag ends outside the text", async () => {
    const outside = document.createElement("div");
    outside.textContent = "Sidebar";
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    document.body.appendChild(outside);
    const text = screen.getByText("Second paragraph of text.").firstChild;
    if (!text || !outside.firstChild) throw new Error("missing text node");

    selectText({
      startNode: text,
      startOffset: 7,
      endNode: outside.firstChild,
      endOffset: 3,
    });
    releaseMouse(outside);

    fireEvent.click(screen.getByRole("button", { name: "Highlight" }));
    await act(async () => {});

    // Only the in-article part is saved
    expect(mutateAsync).toHaveBeenCalledWith({
      startOffset: 31,
      endOffset: 49,
      text: "paragraph of text.",
    });
    outside.remove();
  });

  it("hides the button once a click collapses the selection", () => {
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    const paragraph = screen.getByText("First paragraph of text.");
    const text = paragraph.firstChild;
    if (!text) throw new Error("missing text node");

    selectText({
      startNode: text,
      startOffset: 0,
      endNode: text,
      endOffset: 5,
    });
    releaseMouse(paragraph);
    expect(
      screen.getByRole("button", { name: "Highlight" }),
    ).toBeInTheDocument();

    // The browser collapses a clicked selection after mouseup, so it's read a tick later
    fireEvent.mouseUp(paragraph);
    window.getSelection()?.collapseToStart();
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByRole("button", { name: "Highlight" })).toBeNull();
  });

  it("ignores selections entirely outside the article", () => {
    const outside = document.createElement("div");
    outside.textContent = "Somewhere else entirely";
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    document.body.appendChild(outside);

    const range = document.createRange();
    range.selectNodeContents(outside);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    releaseMouse(outside);

    expect(screen.queryByRole("button", { name: "Highlight" })).toBeNull();
    outside.remove();
  });
});
