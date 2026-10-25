import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTrace } from "@/lib/debug/test-utils";
import { debugTrace, getTraceEvents } from "@/lib/debug/trace";
import { claimUserCaches, releaseUserCaches } from "@/lib/pwa/session-caches";
import { useUserStore } from "@/stores/user-store";
import { SessionStateReset } from "./session-state-reset";

vi.mock("@/lib/pwa/session-caches", () => ({
  claimUserCaches: vi.fn(async () => {}),
  releaseUserCaches: vi.fn(async () => {}),
}));

let queryClient: QueryClient;

function renderReset() {
  render(
    <QueryClientProvider client={queryClient}>
      <SessionStateReset />
    </QueryClientProvider>,
  );
}

function seedUserState() {
  queryClient.setQueryData(["items"], { items: [{ id: "private" }] });
  debugTrace("mark", "mark");
}

const hydrate = (userId: string) =>
  act(() => useUserStore.getState().hydrateUser({ userId, isAdmin: true }));

describe("SessionStateReset", () => {
  beforeEach(() => {
    queryClient = new QueryClient();
    resetTrace();
    useUserStore.getState().clearUser();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    resetTrace({ enabled: false });
    useUserStore.getState().clearUser();
  });

  it("keeps state when the first user hydrates", () => {
    renderReset();
    seedUserState();
    hydrate("user-a");
    expect(queryClient.getQueryData(["items"])).toBeDefined();
    expect(getTraceEvents()).toHaveLength(1);
  });

  it("drops cached queries and the debug trace on sign-out", () => {
    renderReset();
    hydrate("user-a");
    seedUserState();
    act(() => useUserStore.getState().clearUser());
    expect(queryClient.getQueryData(["items"])).toBeUndefined();
    expect(getTraceEvents()).toEqual([]);
  });

  it("drops them when a different user hydrates", () => {
    renderReset();
    hydrate("user-a");
    seedUserState();
    hydrate("user-b");
    expect(queryClient.getQueryData(["items"])).toBeUndefined();
    expect(getTraceEvents()).toEqual([]);
  });

  it("keeps them when the same user's store updates", () => {
    renderReset();
    hydrate("user-a");
    seedUserState();
    // A real store update (a newly hydrated field) with the same user
    act(() =>
      useUserStore
        .getState()
        .hydrateUser({ userId: "user-a", firstName: "Ada" }),
    );
    expect(useUserStore.getState().firstName).toBe("Ada");
    expect(queryClient.getQueryData(["items"])).toBeDefined();
    expect(getTraceEvents()).toHaveLength(1);
  });

  it("claims the service worker caches for a user hydrated before mount", () => {
    hydrate("user-a");
    renderReset();
    expect(claimUserCaches).toHaveBeenCalledWith("user-a");
  });

  it("claims the caches when a user hydrates", () => {
    renderReset();
    hydrate("user-a");
    hydrate("user-b");
    expect(vi.mocked(claimUserCaches).mock.calls).toEqual([
      ["user-a"],
      ["user-b"],
    ]);
  });

  it("releases the caches on sign-out", () => {
    renderReset();
    hydrate("user-a");
    act(() => useUserStore.getState().clearUser());
    expect(releaseUserCaches).toHaveBeenCalledOnce();
  });

  it("leaves the caches alone when the same user's store updates", () => {
    renderReset();
    hydrate("user-a");
    act(() =>
      useUserStore
        .getState()
        .hydrateUser({ userId: "user-a", firstName: "Ada" }),
    );
    expect(claimUserCaches).toHaveBeenCalledOnce();
    expect(releaseUserCaches).not.toHaveBeenCalled();
  });
});
