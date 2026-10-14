import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/lib/invites/use-share-invite-settings", () => ({
  useShareInviteSettings: () => ({ settings: null }),
}));
// The card preview is presentational and needs a layout engine
vi.mock("./highlight-share-card", () => ({
  HIGHLIGHT_CARD_SIZE: { width: 1200, height: 630 },
  HighlightShareCard: () => null,
}));

import { ShareHighlightDialog } from "./share-highlight-dialog";

function renderDialog({ isShared }: { isShared: boolean }) {
  render(
    <ShareHighlightDialog
      open
      onOpenChange={vi.fn()}
      highlight={{ id: "h1", text: "A highlight" }}
      item={{ id: "i1", title: "Article", domain: "example.com" }}
      username="reader"
      isShared={isShared}
      onShared={vi.fn()}
    />,
  );
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

describe("ShareHighlightDialog copy", () => {
  it("copies without waiting on sharing, and confirms once sharing is on", async () => {
    copyToClipboard.mockResolvedValue({ ok: true });
    let finishSharing: () => void = () => {};
    patch.mockReturnValue(
      new Promise<void>((resolve) => {
        finishSharing = resolve;
      }),
    );
    renderDialog({ isShared: false });

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));

    // The copy must start inside the click, before the request settles, or
    // Safari rejects it for lack of user activation
    expect(patch).toHaveBeenCalled();
    expect(copyToClipboard).toHaveBeenCalled();
    await Promise.resolve();
    expect(toast.success).not.toHaveBeenCalled();

    finishSharing();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Link copied"),
    );
  });

  it("doesn't claim the link copied when sharing couldn't be turned on", async () => {
    copyToClipboard.mockResolvedValue({ ok: true });
    patch.mockRejectedValue(new Error("offline"));
    renderDialog({ isShared: false });

    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't turn on sharing for this article",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("explains a failed copy", async () => {
    copyToClipboard.mockResolvedValue({
      ok: false,
      reason: "insecure-context",
    });
    renderDialog({ isShared: true });

    fireEvent.click(screen.getByRole("button", { name: /Copy quote/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to copy", {
        description: expect.stringMatching(/https/),
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
