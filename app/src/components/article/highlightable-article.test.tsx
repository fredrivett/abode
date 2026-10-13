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

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const FIRST = "First paragraph of text.";
const SECOND = "Second paragraph of text.";
const CONTENT = `${FIRST}\n\n${SECOND}`;

beforeAll(() => {
  // jsdom has no layout engine: stub what Radix's popper and the anchor need
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 10, 10);
});

function textNodeOf(el: HTMLElement): Node {
  if (!el.firstChild) throw new Error("missing text node");
  return el.firstChild;
}

/** Sets the selection and fires `selectionchange`, which jsdom doesn't do itself */
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
  document.dispatchEvent(new Event("selectionchange"));
}

function clearSelection() {
  window.getSelection()?.removeAllRanges();
  document.dispatchEvent(new Event("selectionchange"));
}

const runTimers = () => act(() => vi.runAllTimers());
const highlightButton = () =>
  screen.queryByRole("button", { name: "Highlight" });

/** Mouse drag-select from `paragraph`, released on `releaseTarget` */
function mouseSelect({
  paragraph,
  releaseTarget = paragraph,
  ...range
}: Parameters<typeof selectText>[0] & {
  paragraph: HTMLElement;
  releaseTarget?: Element;
}) {
  fireEvent.pointerDown(paragraph, { pointerType: "mouse" });
  selectText(range);
  fireEvent.pointerUp(releaseTarget, { pointerType: "mouse" });
  runTimers();
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
    const paragraph = screen.getByText(FIRST);
    const text = textNodeOf(paragraph);

    mouseSelect({
      paragraph,
      startNode: text,
      startOffset: 0,
      endNode: text,
      endOffset: 5,
    });

    expect(highlightButton()).toBeInTheDocument();
  });

  it("waits for the mouse release instead of following the drag", () => {
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    const paragraph = screen.getByText(FIRST);
    const text = textNodeOf(paragraph);

    fireEvent.pointerDown(paragraph, { pointerType: "mouse" });
    selectText({
      startNode: text,
      startOffset: 0,
      endNode: text,
      endOffset: 5,
    });
    runTimers();
    expect(highlightButton()).not.toBeInTheDocument();

    fireEvent.pointerUp(document, { pointerType: "mouse" });
    runTimers();
    expect(highlightButton()).toBeInTheDocument();
  });

  it("shows the Highlight button when the drag ends outside the text", async () => {
    const outside = document.createElement("div");
    outside.textContent = "Sidebar";
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    document.body.appendChild(outside);
    const paragraph = screen.getByText(SECOND);

    mouseSelect({
      paragraph,
      releaseTarget: outside,
      startNode: textNodeOf(paragraph),
      startOffset: 7,
      endNode: textNodeOf(outside),
      endOffset: 3,
    });

    const button = highlightButton();
    if (!button) throw new Error("expected the Highlight button");
    await act(async () => {
      fireEvent.click(button);
    });

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
    const paragraph = screen.getByText(FIRST);
    const text = textNodeOf(paragraph);

    mouseSelect({
      paragraph,
      startNode: text,
      startOffset: 0,
      endNode: text,
      endOffset: 5,
    });
    expect(highlightButton()).toBeInTheDocument();

    // The browser collapses a clicked selection after release, so it's read a tick later
    fireEvent.pointerDown(paragraph, { pointerType: "mouse" });
    fireEvent.pointerUp(paragraph, { pointerType: "mouse" });
    window.getSelection()?.collapseToStart();
    runTimers();

    expect(highlightButton()).not.toBeInTheDocument();
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
    document.dispatchEvent(new Event("selectionchange"));
    fireEvent.pointerUp(outside, { pointerType: "mouse" });
    runTimers();

    expect(highlightButton()).not.toBeInTheDocument();
    outside.remove();
  });

  it("offers to highlight a touch selection once it settles (no mouseup)", () => {
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    const paragraph = screen.getByText(FIRST);
    const text = textNodeOf(paragraph);

    fireEvent.pointerDown(paragraph, { pointerType: "touch" });
    selectText({
      startNode: text,
      startOffset: 6,
      endNode: text,
      endOffset: 15,
    });

    act(() => vi.advanceTimersByTime(50));
    expect(highlightButton()).not.toBeInTheDocument();
    runTimers();
    expect(highlightButton()).toBeInTheDocument();
  });

  it("ignores selections shorter than three characters", () => {
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    const text = textNodeOf(screen.getByText(FIRST));

    selectText({
      startNode: text,
      startOffset: 0,
      endNode: text,
      endOffset: 2,
    });
    runTimers();

    expect(highlightButton()).not.toBeInTheDocument();
  });

  it("closes the popover when the selection is cleared", () => {
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    const text = textNodeOf(screen.getByText(FIRST));

    selectText({
      startNode: text,
      startOffset: 0,
      endNode: text,
      endOffset: 5,
    });
    runTimers();
    expect(highlightButton()).toBeInTheDocument();

    clearSelection();
    runTimers();
    expect(highlightButton()).not.toBeInTheDocument();
  });

  it("creates the highlight even if tapping the button collapses the selection", async () => {
    render(<HighlightableArticle itemId="a" content={CONTENT} />);
    const paragraph = screen.getByText(FIRST);
    const text = textNodeOf(paragraph);

    fireEvent.pointerDown(paragraph, { pointerType: "touch" });
    selectText({
      startNode: text,
      startOffset: 6,
      endNode: text,
      endOffset: 15,
    });
    runTimers();

    const button = highlightButton();
    if (!button) throw new Error("expected the Highlight button");
    fireEvent.pointerDown(button, { pointerType: "touch" });
    // iOS drops the text selection when the tap starts
    clearSelection();
    runTimers();
    expect(highlightButton()).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(button);
    });
    expect(mutateAsync).toHaveBeenCalledWith({
      startOffset: 6,
      endOffset: 15,
      text: "paragraph",
    });
  });
});
