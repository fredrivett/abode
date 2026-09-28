import { BookReadingStatus } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BOOK_READING_STATUS_ICONS,
  BookReadingStatusBadge,
  NOT_TRACKED_ICON,
} from "./book-reading-status-icon";

const STATUSES = Object.values(BookReadingStatus);

describe("BOOK_READING_STATUS_ICONS", () => {
  it("gives every status (and not tracked) a distinct icon", () => {
    const icons = [
      ...STATUSES.map((s) => BOOK_READING_STATUS_ICONS[s]),
      NOT_TRACKED_ICON,
    ];
    expect(new Set(icons).size).toBe(STATUSES.length + 1);
  });
});

describe("BookReadingStatusBadge", () => {
  it.each([
    ["want_to_read", "Want to read"],
    ["reading", "Reading"],
    ["read", "Read"],
    ["dnf", "Did not finish"],
    [null, "Not tracked"],
  ] as const)("renders the %s icon with its label", (status, label) => {
    const { container } = render(<BookReadingStatusBadge status={status} />);
    // Label is always rendered (hover only widens it) so it stays accessible
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(
      container.querySelector(`svg[data-status="${status ?? "not_tracked"}"]`),
    ).not.toBeNull();
  });
});
