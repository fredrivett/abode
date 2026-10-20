import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import posthog from "posthog-js";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookReview } from "@/lib/books/review";
import type { CopyResult } from "@/lib/copy";

const copyToClipboard = vi.hoisted(() => vi.fn<() => Promise<CopyResult>>());
const patch = vi.hoisted(() => vi.fn());

vi.mock("usehooks-ts", () => ({ useMediaQuery: () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("@/lib/copy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/copy")>()),
  copyToClipboard,
}));
vi.mock("@/lib/api-client", () => ({ api: { patch } }));
vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://abode.test" }));
vi.mock("@/lib/invites/use-share-invite-settings", () => ({
  useShareInviteSettings: () => ({ settings: null }),
}));
// The card preview is presentational and needs a layout engine
vi.mock("./book-review-share-card", () => ({
  BOOK_REVIEW_CARD_SIZE: { width: 1200, height: 630 },
  BookReviewShareCard: () => null,
}));

import { ShareBookReviewDialog } from "./share-book-review-dialog";

const review: BookReview = {
  status: "read",
  rating: 7,
  review: "Fascinating.",
  startedAt: null,
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
};

function renderDialog({
  isShared = true,
  reading = review,
}: {
  isShared?: boolean;
  reading?: BookReview;
} = {}) {
  const onShared = vi.fn();
  render(
    <ShareBookReviewDialog
      open
      onOpenChange={vi.fn()}
      book={{
        id: "i1",
        title: "Elon Musk",
        authors: ["Walter Isaacson"],
        coverUrl: null,
      }}
      review={reading}
      username="fred"
      isShared={isShared}
      onShared={onShared}
    />,
  );
  return { onShared };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

describe("ShareBookReviewDialog", () => {
  it("copies the review page link", async () => {
    copyToClipboard.mockResolvedValue({ ok: true });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Link copied"),
    );
    expect(copyToClipboard).toHaveBeenCalledWith(
      "https://abode.test/@fred/items/i1/review",
    );
    expect(patch).not.toHaveBeenCalled();
    expect(posthog.capture).toHaveBeenCalledWith("book_review_shared", {
      item_id: "i1",
      method: "copy_link",
      has_review: true,
      has_rating: true,
    });
  });

  it("turns on the book's link sharing alongside the copy", async () => {
    copyToClipboard.mockResolvedValue({ ok: true });
    patch.mockResolvedValue({});
    const { onShared } = renderDialog({ isShared: false });
    expect(
      screen.getByText(/Sharing turns on link sharing for this book/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));

    // Both start inside the click, so the copy keeps its user activation
    expect(patch).toHaveBeenCalledWith("/api/v1/items/i1", { shared: true });
    expect(copyToClipboard).toHaveBeenCalled();
    await waitFor(() => expect(onShared).toHaveBeenCalled());
  });

  it("doesn't claim the link copied when sharing couldn't be turned on", async () => {
    copyToClipboard.mockResolvedValue({ ok: true });
    patch.mockRejectedValue(new Error("offline"));
    renderDialog({ isShared: false });

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't turn on sharing for this book",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("copies the review as text, with the book and link", async () => {
    copyToClipboard.mockResolvedValue({ ok: true });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /Copy review/ }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Review copied"),
    );
    expect(copyToClipboard).toHaveBeenCalledWith(
      "★★★½ Elon Musk by Walter Isaacson\n\nFascinating.\n\nhttps://abode.test/@fred/items/i1/review",
    );
  });

  it("offers no review to copy without one", () => {
    renderDialog({ reading: { ...review, review: null } });
    expect(screen.getByText("Share review")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Copy review/ }),
    ).not.toBeInTheDocument();
  });

  it("shares the book, with a nudge, when there's no rating or review", () => {
    renderDialog({ reading: { ...review, rating: null, review: null } });
    expect(screen.getByText("Share book")).toBeInTheDocument();
    expect(
      screen.getByText(/Add a rating or a review to say what you thought/),
    ).toBeInTheDocument();
  });
});
