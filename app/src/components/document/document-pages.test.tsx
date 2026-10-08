import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentPages } from "./document-pages";

const pages = [
  { position: 0, fileKey: "u/p1.jpg", width: 1700, height: 2400 },
  { position: 1, fileKey: "u/p2.jpg", width: 1700, height: 2400 },
  { position: 2, fileKey: "u/p3.jpg", width: 1700, height: 2400 },
];

const base = {
  pageCount: 3,
  coverUrl: "/cover.jpg",
  title: "Council tax bill",
};

// jsdom has no layout or scrolling: give the track a width, and make
// scrollTo move it and fire a scroll event the way a browser does
const scrollTo = vi.fn(function (
  this: Element,
  options?: ScrollToOptions | number,
) {
  if (typeof options === "object" && options.left !== undefined) {
    this.scrollLeft = options.left;
    this.dispatchEvent(new Event("scroll"));
  }
});
beforeEach(() => {
  scrollTo.mockClear();
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 400,
  });
});

const track = () => screen.getAllByRole("img")[0].closest("div")?.parentElement;

describe("DocumentPages", () => {
  it("lays every page out in order, starting on page 1", () => {
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(images[1]).toHaveAttribute("alt", "Council tax bill, page 2");
    expect(images[2].getAttribute("src")).toContain(
      encodeURIComponent("u/p3.jpg"),
    );
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("reserves each page's shape so pages don't jump as they load", () => {
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("height", "2400");
  });

  it("follows swipes, updating the counter", () => {
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    const scroller = track();
    if (!scroller) throw new Error("no track");
    scroller.scrollLeft = 800;
    fireEvent.scroll(scroller);
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
  });

  it("pages with the arrows, disabled at either end", () => {
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(scrollTo).toHaveBeenCalledWith({ left: 400, behavior: "smooth" });
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("shows the cover while the pages load", () => {
    render(<DocumentPages {...base} pages={null} status="loading" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/cover.jpg");
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Loading pages" }),
    ).toBeDisabled();
  });

  it("keeps page 1's image mounted once the pages arrive", () => {
    const { rerender } = render(
      <DocumentPages {...base} pages={null} status="loading" />,
    );
    const cover = screen.getByRole("img");
    rerender(<DocumentPages {...base} pages={pages} status="ready" />);
    expect(screen.getAllByRole("img")[0]).toBe(cover);
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("keeps the cover and explains when the pages fail to load", () => {
    render(<DocumentPages {...base} pages={null} status="error" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/cover.jpg");
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Failed to load other pages")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("pages with the ← and → keys, stopping at either end", () => {
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("1 of 3")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("3 of 3")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("leaves the arrow keys alone while typing or with a modifier held", () => {
    render(
      <>
        <input aria-label="Notes" />
        <DocumentPages {...base} pages={pages} status="ready" />
      </>,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Notes" }), {
      key: "ArrowRight",
    });
    fireEvent.keyDown(window, { key: "ArrowRight", metaKey: true });
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("doesn't collapse quick presses while the smooth scroll is in flight", () => {
    // A real smooth scroll reports its position only as it arrives
    const inFlight = vi.fn();
    Object.defineProperty(Element.prototype, "scrollTo", {
      configurable: true,
      value: inFlight,
    });
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(inFlight).toHaveBeenLastCalledWith({
      left: 800,
      behavior: "smooth",
    });
    // …and it doesn't run past the last page
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(inFlight).toHaveBeenCalledTimes(2);
  });

  it("lets a swipe take over from a pending key press", () => {
    const inFlight = vi.fn();
    Object.defineProperty(Element.prototype, "scrollTo", {
      configurable: true,
      value: inFlight,
    });
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const scroller = track();
    if (!scroller) throw new Error("no track");
    fireEvent.pointerDown(scroller);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    // Still on page 1 as far as the scroll position says, so → aims at page 2
    expect(inFlight).toHaveBeenLastCalledWith({
      left: 400,
      behavior: "smooth",
    });
  });

  it("tells the owner how many scanned pages search can't find", () => {
    render(
      <DocumentPages
        {...base}
        pages={pages}
        status="ready"
        ocrSkippedPages={12}
      />,
    );
    expect(
      screen.getByText(
        "12 scanned pages not searchable — text is read from up to 30 per document, within your daily limit",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing about search when every page was read", () => {
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    expect(screen.queryByText(/not searchable/)).not.toBeInTheDocument();
  });
});
