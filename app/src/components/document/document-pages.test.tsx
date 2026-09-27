import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("DocumentPages", () => {
  it("shows every page in order with its number", () => {
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(images[1]).toHaveAttribute("alt", "Council tax bill, page 2");
    expect(images[2].getAttribute("src")).toContain(
      encodeURIComponent("u/p3.jpg"),
    );
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
  });

  it("reserves each page's shape so the list doesn't jump as images load", () => {
    render(<DocumentPages {...base} pages={pages} status="ready" />);
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("height", "2400");
  });

  it("shows the cover while the pages load", () => {
    render(<DocumentPages {...base} pages={null} status="loading" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/cover.jpg");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText(/Loading pages/)).toBeInTheDocument();
  });

  it("keeps the cover and explains when the pages fail to load", () => {
    render(<DocumentPages {...base} pages={null} status="error" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/cover.jpg");
    expect(
      screen.getByText("Couldn't load the rest of this document's pages."),
    ).toBeInTheDocument();
  });
});
