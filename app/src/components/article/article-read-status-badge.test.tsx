import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleReadStatusBadge } from "./article-read-status-badge";

describe("ArticleReadStatusBadge", () => {
  it.each([
    [null, "Unread", "unread"],
    ["2024-01-10T00:00:00.000Z", "Read", "read"],
  ] as const)("readAt %s shows %s", (readAt, label, status) => {
    const { container } = render(<ArticleReadStatusBadge readAt={readAt} />);
    // Label is always rendered (hover only widens it) so it stays accessible
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(
      container.querySelector(`svg[data-status="${status}"]`),
    ).not.toBeNull();
  });
});
