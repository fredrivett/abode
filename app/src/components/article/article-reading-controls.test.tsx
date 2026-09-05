import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleReadingControls } from "./article-reading-controls";

const setRead = vi.fn();
vi.mock("@/lib/items/use-article-reading", () => ({
  useArticleReading: () => ({ setRead, saveScrollProgress: vi.fn() }),
}));

describe("ArticleReadingControls", () => {
  beforeEach(() => setRead.mockClear());

  it("labels the action 'Mark as read' when unread", () => {
    render(<ArticleReadingControls itemId="a" readAt={null} />);
    expect(
      screen.getByRole("button", { name: "Mark as read" }),
    ).toBeInTheDocument();
  });

  it("labels the action 'Mark as unread' when read", () => {
    render(
      <ArticleReadingControls itemId="a" readAt="2026-09-01T09:00:00.000Z" />,
    );
    expect(
      screen.getByRole("button", { name: "Mark as unread" }),
    ).toBeInTheDocument();
  });

  it("marks read and optimistically flips the label", () => {
    render(<ArticleReadingControls itemId="a" readAt={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(setRead).toHaveBeenCalledWith(true);
    // Optimistic: the label now offers the reverse action
    expect(
      screen.getByRole("button", { name: "Mark as unread" }),
    ).toBeInTheDocument();
  });
});
