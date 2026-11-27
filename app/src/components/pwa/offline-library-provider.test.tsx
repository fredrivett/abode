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

import { useOfflineLibrary } from "@/lib/offline/offline-library-context";
import { OfflineLibraryProvider } from "./offline-library-provider";

let provided: ReturnType<typeof useOfflineLibrary> = null;
function Reader() {
  provided = useOfflineLibrary();
  return null;
}
function OfflineLibrarySync() {
  return (
    <OfflineLibraryProvider>
      <Reader />
    </OfflineLibraryProvider>
  );
}

const store = (lastSyncedAt: string | null = null) => {
  let state = lastSyncedAt && { cursor: "c", lastSyncedAt };
  return {
    putItems: vi.fn(async () => {}),
    close: vi.fn(),
    getSyncState: vi.fn(async () => state),
    finishSync: (at: string) => {
      state = { cursor: "c", lastSyncedAt: at };
    },
  };
};

describe("OfflineLibraryProvider", () => {
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
    provided = null;
    useUserStore.getState().clearUser();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it("provides the library only once a sync round has finished", async () => {
    m.claim.mockResolvedValue();
    const opened = store();
    m.open.mockResolvedValue(opened);
    let finishRound = () => {};
    m.sync.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRound = () => {
            opened.finishSync("2026-11-27T10:00:00.000Z");
            resolve({ status: "synced", firstSync: true, itemCount: 1 });
          };
        }),
    );

    render(<OfflineLibrarySync />);
    await waitFor(() => expect(m.sync).toHaveBeenCalled());
    // A first sync still under way: a partial library isn't offered
    expect(provided).toBeNull();

    await act(async () => finishRound());
    await waitFor(() =>
      expect(provided).toEqual({
        store: opened,
        lastSyncedAt: "2026-11-27T10:00:00.000Z",
      }),
    );
  });

  it("provides an earlier session's library at once, without a connection to sync", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    m.claim.mockResolvedValue();
    const opened = store("2026-11-20T09:00:00.000Z");
    m.open.mockResolvedValue(opened);
    m.sync.mockImplementation(() => new Promise(() => {}));

    render(<OfflineLibrarySync />);
    await waitFor(() =>
      expect(provided?.lastSyncedAt).toBe("2026-11-20T09:00:00.000Z"),
    );
    expect(m.sync).not.toHaveBeenCalled();
  });

  it("stops providing the library once a sync finds the session ended", async () => {
    m.claim.mockResolvedValue();
    m.open.mockResolvedValue(store("2026-11-20T09:00:00.000Z"));
    m.sync.mockResolvedValue({ status: "signed-out" });

    render(<OfflineLibrarySync />);
    await waitFor(() => expect(m.sync).toHaveBeenCalled());
    await waitFor(() => expect(provided).toBeNull());
  });

  it("does nothing while nobody is signed in", async () => {
    useUserStore.getState().clearUser();
    render(<OfflineLibrarySync />);
    await act(async () => {});
    expect(m.claim).not.toHaveBeenCalled();
    expect(m.open).not.toHaveBeenCalled();
  });
});
