import { BookReadingStatus } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BOOK_READING_STATUS_ICONS,
  BookReadingStatusBadge,
} from "./book-reading-status-icon";

const STATUSES = Object.values(BookReadingStatus);

describe("BOOK_READING_STATUS_ICONS", () => {
  it("gives every status a distinct icon", () => {
    const icons = STATUSES.map((s) => BOOK_READING_STATUS_ICONS[s]);
    expect(new Set(icons).size).toBe(STATUSES.length);
  });
});

describe("BookReadingStatusBadge", () => {
  it.each([
    ["want_to_read", "Want to read"],
    ["reading", "Reading"],
    ["read", "Read"],
    ["dnf", "Did not finish"],
  ] as const)(
    "labels the %s badge for screen readers and on hover",
    (status, label) => {
      const { container } = render(<BookReadingStatusBadge status={status} />);
      expect(screen.getByText(label)).toHaveClass("sr-only");
      expect(container.firstElementChild).toHaveAttribute("title", label);
      expect(
        container.querySelector(`svg[data-status="${status}"]`),
      ).not.toBeNull();
    },
  );
});
