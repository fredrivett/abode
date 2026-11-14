import type { ProcessingStatus } from "@prisma/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api-client";
import {
  detectProcessingChanges,
  pollDelayMs,
  useProcessingPoll,
} from "./use-processing-poll";

vi.mock("./api-client", () => ({ api: { get: vi.fn() } }));

type Item = {
  id: string;
  processingStatus: ProcessingStatus;
  updatedAt: string;
};

const item = (
  id: string,
  processingStatus: ProcessingStatus,
  updatedAt: string,
): Item => ({ id, processingStatus, updatedAt });

describe("detectProcessingChanges", () => {
  it("reports no change on first sighting (records baseline only)", () => {
    const lastSeen = new Map<string, string>();
    const result = detectProcessingChanges(
      [item("a", "processing", "t1")],
      lastSeen,
    );

    expect(result.changed).toBe(false);
    expect(result.finished).toEqual([]);
    expect(result.updated).toEqual([]);
    // Baseline recorded so the next change is detectable
    expect(lastSeen.get("a")).toBe("t1");
  });

  it("detects a mid-processing update when updatedAt changes", () => {
    const lastSeen = new Map<string, string>([["a", "t1"]]);
    const result = detectProcessingChanges(
      [item("a", "processing", "t2")],
      lastSeen,
    );

    expect(result.changed).toBe(true);
    expect(result.updated.map((i) => i.id)).toEqual(["a"]);
    expect(lastSeen.get("a")).toBe("t2");
  });

  it("does not report an update when updatedAt is unchanged", () => {
    const lastSeen = new Map<string, string>([["a", "t1"]]);
    const result = detectProcessingChanges(
      [item("a", "processing", "t1")],
      lastSeen,
    );

    expect(result.changed).toBe(false);
    expect(result.updated).toEqual([]);
  });

  it("treats completed items as finished", () => {
    const result = detectProcessingChanges(
      [item("a", "completed", "t1")],
      new Map(),
    );

    expect(result.changed).toBe(true);
    expect(result.finished.map((i) => i.id)).toEqual(["a"]);
  });

  it("treats failed items as finished", () => {
    const result = detectProcessingChanges(
      [item("a", "failed", "t1")],
      new Map(),
    );

    expect(result.changed).toBe(true);
    expect(result.finished.map((i) => i.id)).toEqual(["a"]);
  });

  it("does not treat deferred items as finished (parked, resumed by the sweep)", () => {
    const result = detectProcessingChanges(
      [item("a", "deferred", "t1")],
      new Map(),
    );
    expect(result.finished).toEqual([]);
  });

  it("flags a change when a URL is classified mid-processing (new kind persisted)", () => {
    // Item was still processing when the grid loaded it (baseline recorded),
    // then classify-url writes `kind: book` and bumps updatedAt — this is the
    // moment the filter options (type list) go stale and must be refreshed.
    const lastSeen = new Map<string, string>([["book-item", "created"]]);
    const result = detectProcessingChanges(
      [item("book-item", "processing", "classified")],
      lastSeen,
    );

    expect(result.changed).toBe(true);
    expect(result.updated.map((i) => i.id)).toEqual(["book-item"]);
  });

  it("returns no change for an empty response", () => {
    const result = detectProcessingChanges([], new Map());
    expect(result.changed).toBe(false);
  });
});

describe("detectProcessingChanges (finished items)", () => {
  it("reports a finished item once, not again while its card catches up", () => {
    const lastSeen = new Map<string, string>([["a", "t1"]]);
    const first = detectProcessingChanges(
      [item("a", "completed", "t2")],
      lastSeen,
    );
    const again = detectProcessingChanges(
      [item("a", "completed", "t2")],
      lastSeen,
    );

    expect(first.finished.map((i) => i.id)).toEqual(["a"]);
    expect(again.changed).toBe(false);
  });
});

describe("pollDelayMs", () => {
  it("polls fast while an item is changing and backs off to once a minute", () => {
    expect(pollDelayMs(0)).toBe(1500);
    expect(pollDelayMs(60_000)).toBe(6000);
    expect(pollDelayMs(60 * 60_000)).toBe(60_000);
  });
});

describe("useProcessingPoll", () => {
  const ids = (count: number) =>
    Array.from({ length: count }, (_, i) => `item-${i}`);

  // `/status?ids=a,b` batches only
  const requestedIds = () =>
    vi
      .mocked(api.get)
      .mock.calls.map(([url]) => String(url))
      .filter((url) => url.includes("/status"))
      .map((url) => decodeURIComponent(url.split("ids=")[1]).split(","));

  function renderPoll(processingIds: string[]) {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const hook = renderHook((idList: string[]) => useProcessingPoll(idList), {
      wrapper,
      initialProps: processingIds,
    });
    return { ...hook, invalidate };
  }

  function setHidden(hidden: boolean) {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(api.get).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  it("splits more than 50 processing items into batches the endpoint accepts", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    renderPoll(ids(120));

    await vi.advanceTimersByTimeAsync(1000);

    const batches = requestedIds();
    expect(batches.map((batch) => batch.length)).toEqual([50, 50, 20]);
    expect(new Set(batches.flat()).size).toBe(120);
  });

  it("never starts a poll while the previous one is in flight", async () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    renderPoll(ids(1));

    await vi.advanceTimersByTimeAsync(60_000);

    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("backs off an item that stops changing", async () => {
    vi.mocked(api.get).mockResolvedValue({
      items: [item("item-0", "processing", "t1")],
    });
    renderPoll(ids(1));

    await vi.advanceTimersByTimeAsync(30 * 60_000);

    // Fixed 1.5s polling would be 1200 requests in 30 minutes; capped at one
    // a minute once quiet it's a few dozen
    expect(vi.mocked(api.get).mock.calls.length).toBeLessThan(80);
    const callsBefore = vi.mocked(api.get).mock.calls.length;
    await vi.advanceTimersByTimeAsync(59_000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(api.get).mock.calls.length).toBe(callsBefore + 1);
  });

  it("doesn't poll while the tab is hidden, and catches up once it's visible", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    renderPoll(ids(1));
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.get).toHaveBeenCalledTimes(1);

    setHidden(true);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(api.get).toHaveBeenCalledTimes(1);

    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("fetches just a finished item, once", async () => {
    const statuses = [
      { items: [item("item-0", "processing", "t1")] },
      { items: [item("item-0", "completed", "t2")] },
    ];
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes("/status")
        ? (statuses.shift() ?? statuses[0])
        : { items: [] },
    );
    const { invalidate } = renderPoll(ids(1));

    await vi.advanceTimersByTimeAsync(60_000);

    const urls = vi.mocked(api.get).mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.startsWith("/api/v1/items?ids="))).toEqual([
      "/api/v1/items?ids=item-0",
    ]);
    // Never the whole list
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ["items"] });
    // The finished item isn't polled again
    expect(urls.filter((url) => url.includes("/status"))).toHaveLength(2);
  });

  it("reports a change again when fetching the item failed", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes("/status")) {
        return { items: [item("item-0", "completed", "t2")] };
      }
      throw new Error("offline");
    });
    renderPoll(ids(1));

    await vi.advanceTimersByTimeAsync(5000);

    const refreshes = vi
      .mocked(api.get)
      .mock.calls.filter(([url]) => String(url).includes("?ids="));
    expect(refreshes.length).toBeGreaterThan(1);
  });
});
