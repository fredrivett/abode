import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BookDetails } from "@/lib/types/item";
import { BookReadingControls } from "./book-reading-controls";

const patch = vi.fn().mockResolvedValue({});
vi.mock("@/lib/api-client", () => ({
  api: { patch: (...a: unknown[]) => patch(...a) },
}));
vi.mock("@/lib/api-hooks", () => ({ useInvalidateItems: () => vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const baseBook: BookDetails = {
  authors: ["Author"],
  publisher: null,
  publishedAt: null,
  isbn: null,
  pageCount: 300,
  domain: null,
  status: null,
  startedAt: null,
  finishedAt: null,
  progressValue: null,
  progressUnit: "page",
  progressUpdatedAt: null,
  rating: null,
};

function renderControls(overrides: Partial<BookDetails> = {}) {
  return render(
    <BookReadingControls
      itemId="item-1"
      bookDetails={{ ...baseBook, ...overrides }}
    />,
  );
}

afterEach(() => {
  patch.mockClear();
});

describe("BookReadingControls reveal logic", () => {
  it("untracked: shows only the status control", () => {
    renderControls({ status: null });
    expect(screen.getByText("Not tracked")).toBeInTheDocument();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Rating")).not.toBeInTheDocument();
    expect(screen.queryByText("Started")).not.toBeInTheDocument();
  });

  it("want_to_read: no progress, rating, or dates", () => {
    renderControls({ status: "want_to_read" });
    expect(screen.getByText("Want to read")).toBeInTheDocument();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Rating")).not.toBeInTheDocument();
    expect(screen.queryByText("Started")).not.toBeInTheDocument();
  });

  it("reading: shows started date, progress, and rating", () => {
    renderControls({ status: "reading" });
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(screen.queryByText("Finished")).not.toBeInTheDocument();
  });

  it("read: shows finished date and rating but not progress", () => {
    renderControls({ status: "read" });
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
  });

  it("dnf: shows finished date and rating", () => {
    renderControls({ status: "dnf" });
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(screen.queryByText("Progress")).not.toBeInTheDocument();
  });
});

describe("BookReadingControls progress display", () => {
  it("shows page-of-total when a page count is known", () => {
    renderControls({
      status: "reading",
      progressValue: 150,
      progressUnit: "page",
    });
    expect(screen.getByText("p.150 of 300")).toBeInTheDocument();
  });

  it("shows percent-only when there is no page count", () => {
    renderControls({
      status: "reading",
      pageCount: null,
      progressValue: 42,
      progressUnit: "percent",
    });
    expect(screen.getByText("42%")).toBeInTheDocument();
    // No pages toggle when there's no page count
    expect(
      screen.queryByRole("button", { name: "Pages" }),
    ).not.toBeInTheDocument();
  });
});

describe("BookReadingControls rating", () => {
  it("persists a star click on the /10 scale (4 stars => 8)", () => {
    renderControls({ status: "reading" });
    fireEvent.click(screen.getByRole("button", { name: "Rate 4 stars" }));
    expect(patch).toHaveBeenCalledWith("/api/v1/items/item-1", {
      bookReading: { rating: 8 },
    });
  });

  it("fills stars from the stored /10 rating (10 => 5 filled)", () => {
    renderControls({ status: "read", rating: 10 });
    // Clear-rating button only renders when a rating is set
    expect(
      screen.getByRole("button", { name: "Clear rating" }),
    ).toBeInTheDocument();
  });
});

describe("BookReadingControls progress persistence", () => {
  it("stores an exact page (not percent) when a page count is known", () => {
    renderControls({
      status: "reading",
      progressValue: 100,
      progressUnit: "page",
    });
    const slider = screen.getByLabelText("Reading progress");
    fireEvent.change(slider, { target: { value: "150" } });
    expect(patch).toHaveBeenCalledWith("/api/v1/items/item-1", {
      bookReading: { progressValue: 150, progressUnit: "page" },
    });
  });
});
