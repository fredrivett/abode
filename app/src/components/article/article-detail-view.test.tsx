import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleDetailView } from "./article-detail-view";

const setRead = vi.fn();
vi.mock("@/lib/items/use-article-reading", () => ({
  useArticleReading: () => ({
    setRead,
    saveScrollProgress: Object.assign(vi.fn(), { flush: vi.fn() }),
  }),
}));
vi.mock("./highlightable-article", () => ({
  HighlightableArticle: () => <div>article body</div>,
}));

const READ_AT = "2026-09-01T09:00:00.000Z";

function renderView(readAt: string | null, enableTracking = true) {
  return render(
    <ArticleDetailView
      itemId="a"
      content="Body"
      readAt={readAt}
      enableTracking={enableTracking}
    />,
  );
}

describe("ArticleDetailView end-of-article toggle", () => {
  beforeEach(() => {
    setRead.mockReset();
    setRead.mockResolvedValue(true);
  });

  it("offers 'Mark as read' when unread", () => {
    renderView(null);
    const button = screen.getByRole("button", { name: "Mark as read" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText("You've reached the end. Mark this article as read?"),
    ).toBeInTheDocument();
  });

  it("stays visible as 'Marked as read' when read", () => {
    renderView(READ_AT);
    const button = screen.getByRole("button", { name: "Marked as read" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByText("You've reached the end.")).toBeInTheDocument();
  });

  it("marks read without hiding the button", async () => {
    renderView(null);
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(setRead).toHaveBeenCalledWith(true);
    expect(
      await screen.findByRole("button", { name: "Marked as read" }),
    ).toBeInTheDocument();
  });

  it("clicking 'Marked as read' sets it back to unread", async () => {
    renderView(READ_AT);
    fireEvent.click(screen.getByRole("button", { name: "Marked as read" }));
    expect(setRead).toHaveBeenCalledWith(false);
    expect(
      await screen.findByRole("button", { name: "Mark as read" }),
    ).toBeInTheDocument();
  });

  it("reverts the optimistic flip when the save fails", async () => {
    setRead.mockResolvedValue(false);
    renderView(null);
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
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
    renderView(null);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button).toBeDisabled();
    resolveSave(true);
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("hides the toggle for read-only viewers", () => {
    renderView(null, false);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
