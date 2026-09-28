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
    expect(screen.getByText(/Loading pages/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("keeps the cover and explains when the pages fail to load", () => {
    render(<DocumentPages {...base} pages={null} status="error" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/cover.jpg");
    expect(
      screen.getByText("Couldn't load the rest of this document's pages."),
    ).toBeInTheDocument();
  });
});
