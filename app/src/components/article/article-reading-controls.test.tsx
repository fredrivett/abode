import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleReadingControls } from "./article-reading-controls";

const setRead = vi.fn();
vi.mock("@/lib/items/use-article-reading", () => ({
  useArticleReading: () => ({ setRead, saveScrollProgress: vi.fn() }),
}));

describe("ArticleReadingControls", () => {
  beforeEach(() => {
    setRead.mockReset();
    setRead.mockResolvedValue(true);
  });

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

  it("marks read and optimistically flips the label", async () => {
    render(<ArticleReadingControls itemId="a" readAt={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(setRead).toHaveBeenCalledWith(true);
    expect(
      await screen.findByRole("button", { name: "Mark as unread" }),
    ).toBeInTheDocument();
  });

  it("reverts the optimistic flip when the save fails", async () => {
    setRead.mockResolvedValue(false);
    render(<ArticleReadingControls itemId="a" readAt={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    // Flips optimistically, then reverts once the failed save resolves.
    expect(
      await screen.findByRole("button", { name: "Mark as read" }),
    ).toBeInTheDocument();
  });

  it("disables the toggle while a save is in flight", async () => {
    let resolveSave: (ok: boolean) => void = () => {};
    setRead.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<ArticleReadingControls itemId="a" readAt={null} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button).toBeDisabled();
    resolveSave(true);
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
