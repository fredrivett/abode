import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
  progressValue: null,
  progressUnit: "page",
  progressUpdatedAt: null,
  rating: null,
  review: null,
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
  patch.mockReset();
  patch.mockResolvedValue({});
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

describe("BookReadingControls date precision", () => {
  it("formats a month-precision date without a day", () => {
    renderControls({
      status: "reading",
      startedAt: "2026-06-15T00:00:00.000Z",
      startedAtPrecision: "month",
    });
    expect(screen.getByText("Jun 2026")).toBeInTheDocument();
  });

  it("formats a year-precision date as just the year", () => {
    renderControls({
      status: "read",
      finishedAt: "2019-06-15T00:00:00.000Z",
      finishedAtPrecision: "year",
    });
    expect(screen.getByText("2019")).toBeInTheDocument();
  });

  it("shows a pre-migration date (non-null value, null precision) as a full date instead of Set date", () => {
    renderControls({
      status: "reading",
      // Midday UTC so the local calendar day is stable across timezones —
      // day precision formats in local time, and a midnight UTC timestamp
      // would render as the previous day west of UTC.
      startedAt: "2024-03-05T12:00:00.000Z",
      startedAtPrecision: null,
    });
    expect(screen.getByText("Mar 5, 2024")).toBeInTheDocument();
    expect(screen.queryByText("Set date")).not.toBeInTheDocument();
  });

  it("highlights the calendar day for a pre-migration date (null precision)", () => {
    renderControls({
      status: "reading",
      startedAt: "2024-03-05T12:00:00.000Z",
      startedAtPrecision: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "Mar 5, 2024" }));
    expect(
      screen.getByRole("button", { name: /March 5th, 2024/ }),
    ).toHaveAttribute("data-selected-single", "true");
  });

  it("defaults the Day tab calendar to the set value's month, not today", () => {
    renderControls({
      status: "reading",
      startedAt: "2016-01-01T00:00:00.000Z",
      startedAtPrecision: "year",
    });
    fireEvent.click(screen.getByRole("button", { name: "2016" }));
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(screen.getByText("January 2016")).toBeInTheDocument();
  });

  it("highlights only the matching month, not a day or year, for a month-precision value", () => {
    renderControls({
      status: "reading",
      // Midday UTC so the local calendar day is stable across timezones —
      // the Day tab's calendar renders in local time.
      startedAt: "2010-02-01T12:00:00.000Z",
      startedAtPrecision: "month",
    });
    fireEvent.click(screen.getByRole("button", { name: "Feb 2010" }));
    expect(screen.getByRole("button", { name: "Feb" }).className).toContain(
      "bg-secondary",
    );
    expect(screen.getByRole("button", { name: "Jan" }).className).not.toContain(
      "bg-secondary",
    );

    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(
      screen.getByRole("button", { name: "Monday, February 1st, 2010" })
        .className,
    ).not.toContain("bg-secondary");

    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    expect(
      screen.getByRole("button", { name: "2010" }).className,
    ).not.toContain("bg-secondary");
  });

  it("highlights only the matching year, not a month or day, for a year-precision value", () => {
    renderControls({
      status: "reading",
      startedAt: "2010-01-01T00:00:00.000Z",
      startedAtPrecision: "year",
    });
    // The trigger button and the grid cell for the selected year share the
    // same "2010" accessible name once the popover is open — disambiguate by
    // reference rather than name.
    const trigger = screen.getByRole("button", { name: "2010" });
    fireEvent.click(trigger);
    const yearButtons = screen
      .getAllByRole("button", { name: "2010" })
      .filter((btn) => btn !== trigger);
    expect(yearButtons).toHaveLength(1);
    expect(yearButtons[0].className).toContain("bg-secondary");
    expect(
      screen.getByRole("button", { name: "2009" }).className,
    ).not.toContain("bg-secondary");

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByRole("button", { name: "Jan" }).className).not.toContain(
      "bg-secondary",
    );
  });

  it("picks a month-only start date via the Month tab", () => {
    renderControls({ status: "reading" });
    fireEvent.click(screen.getByRole("button", { name: /Set date/i }));
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    fireEvent.click(screen.getByRole("button", { name: "Jan" }));
    const now = new Date();
    expect(patch).toHaveBeenCalledWith("/api/v1/items/item-1", {
      bookReading: {
        startedAt: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString(),
        startedAtPrecision: "month",
      },
    });
  });

  it("picks a year-only start date via the Year tab", () => {
    renderControls({ status: "reading" });
    fireEvent.click(screen.getByRole("button", { name: /Set date/i }));
    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    fireEvent.click(screen.getByRole("button", { name: "2019" }));
    expect(patch).toHaveBeenCalledWith("/api/v1/items/item-1", {
      bookReading: {
        startedAt: new Date(Date.UTC(2019, 0, 1)).toISOString(),
        startedAtPrecision: "year",
      },
    });
  });

  it("disables paging into the future on the Year tab", () => {
    renderControls({ status: "reading" });
    fireEvent.click(screen.getByRole("button", { name: /Set date/i }));
    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    expect(screen.getByRole("button", { name: "Next years" })).toBeDisabled();
  });

  it("pages back to select a year outside the initial 12-year window", () => {
    renderControls({ status: "reading" });
    fireEvent.click(screen.getByRole("button", { name: /Set date/i }));
    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    // 1950 isn't in the initial window (current year and the 11 before it)
    expect(
      screen.queryByRole("button", { name: "1950" }),
    ).not.toBeInTheDocument();
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Previous years" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "1950" }));
    expect(patch).toHaveBeenCalledWith("/api/v1/items/item-1", {
      bookReading: {
        startedAt: new Date(Date.UTC(1950, 0, 1)).toISOString(),
        startedAtPrecision: "year",
      },
    });
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
  it("debounces to store an exact page (not percent) when a page count is known", async () => {
    renderControls({
      status: "reading",
      progressValue: 100,
      progressUnit: "page",
    });
    const slider = screen.getByLabelText("Reading progress");
    // A rapid drag fires several onChange events...
    fireEvent.change(slider, { target: { value: "120" } });
    fireEvent.change(slider, { target: { value: "150" } });
    // ...but only the final value is persisted, in one debounced request.
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/api/v1/items/item-1", {
        bookReading: { progressValue: 150, progressUnit: "page" },
      }),
    );
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it("keeps an unrelated rating when a progress request fails", async () => {
    // Progress writes fail; everything else (the rating) succeeds.
    patch.mockImplementation(
      (_url: string, body: { bookReading?: unknown }) => {
        const reading = body.bookReading as { progressValue?: number };
        return reading?.progressValue !== undefined
          ? Promise.reject(new Error("boom"))
          : Promise.resolve({});
      },
    );
    renderControls({
      status: "reading",
      progressValue: 100,
      progressUnit: "page",
    });

    // Rate 4 stars (persists immediately, optimistic state updates)
    fireEvent.click(screen.getByRole("button", { name: "Rate 4 stars" }));
    expect(
      screen.getByRole("button", { name: "Clear rating" }),
    ).toBeInTheDocument();

    // Drag progress — the debounced write fails
    fireEvent.change(screen.getByLabelText("Reading progress"), {
      target: { value: "150" },
    });
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/api/v1/items/item-1", {
        bookReading: { progressValue: 150, progressUnit: "page" },
      }),
    );

    // The failed progress rollback must not wipe the successful rating
    expect(
      screen.getByRole("button", { name: "Clear rating" }),
    ).toBeInTheDocument();
    // ...and progress rolled back to the last server value (page 100)
    expect(screen.getByText("p.100 of 300")).toBeInTheDocument();
  });
});
