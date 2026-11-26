import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/lib/types/item";
import { useUserStore } from "@/stores/user-store";

const m = vi.hoisted(() => ({
  claim: vi.fn<(userId: string) => Promise<void>>(),
  open: vi.fn(),
  sync: vi.fn(),
  listener: null as ((item: Item) => void) | null,
}));

vi.mock("posthog-js", () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));
vi.mock("@/lib/api-client", () => ({ api: { get: vi.fn() } }));
vi.mock("@/lib/api-hooks", () => ({
  useOnReplacedCachedItem: (listener: (item: Item) => void) => {
    m.listener = listener;
  },
}));
vi.mock("@/lib/pwa/session-caches", () => ({ claimUserCaches: m.claim }));
vi.mock("@/lib/offline/item-store", () => ({ openOfflineItemStore: m.open }));
vi.mock("@/lib/offline/sync", () => ({
  syncOfflineLibrary: m.sync,
  withSyncLock: (task: () => Promise<void>) => task(),
}));

import { OfflineLibrarySync } from "./offline-library-sync";

const store = () => ({ putItems: vi.fn(async () => {}), close: vi.fn() });

describe("OfflineLibrarySync", () => {
  beforeEach(() => {
    vi.stubGlobal("requestIdleCallback", (run: () => void) => run());
    m.sync.mockResolvedValue({
      status: "synced",
      firstSync: false,
      itemCount: 0,
    });
    useUserStore.getState().hydrateUser({ userId: "user-a" });
  });

  afterEach(() => {
    useUserStore.getState().clearUser();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("opens the library only once the previous user's data is cleared, then syncs", async () => {
    let finishClaim = () => {};
    m.claim.mockReturnValue(
      new Promise<void>((resolve) => (finishClaim = resolve)),
    );
    const opened = store();
    m.open.mockResolvedValue(opened);

    render(<OfflineLibrarySync />);
    await act(async () => {});
    expect(m.claim).toHaveBeenCalledWith("user-a");
    expect(m.open).not.toHaveBeenCalled();

    await act(async () => finishClaim());
    await waitFor(() => expect(m.sync).toHaveBeenCalledTimes(1));
    expect(m.open).toHaveBeenCalledWith("user-a");
  });

  it("syncs again when the connection comes back, and closes the library on unmount", async () => {
    m.claim.mockResolvedValue();
    const opened = store();
    m.open.mockResolvedValue(opened);

    const { unmount } = render(<OfflineLibrarySync />);
    await waitFor(() => expect(m.sync).toHaveBeenCalledTimes(1));
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(m.sync).toHaveBeenCalledTimes(2));

    unmount();
    expect(opened.close).toHaveBeenCalled();
  });

  it("stores items this tab updates as slim cards, without the article body", async () => {
    m.claim.mockResolvedValue();
    const opened = store();
    m.open.mockResolvedValue(opened);
    render(<OfflineLibrarySync />);
    await waitFor(() => expect(m.open).toHaveBeenCalled());
    await act(async () => {});

    m.listener?.({
      id: "a",
      ocrText: null,
      articleDetails: { content: "long body" },
    } as Item);
    expect(opened.putItems).toHaveBeenCalledWith([
      expect.objectContaining({ id: "a", articleDetails: { content: null } }),
    ]);
  });

  it("does nothing while nobody is signed in", async () => {
    useUserStore.getState().clearUser();
    render(<OfflineLibrarySync />);
    await act(async () => {});
    expect(m.claim).not.toHaveBeenCalled();
    expect(m.open).not.toHaveBeenCalled();
  });
});
