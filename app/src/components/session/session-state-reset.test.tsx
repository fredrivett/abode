import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetTrace } from "@/lib/debug/test-utils";
import { debugTrace, getTraceEvents } from "@/lib/debug/trace";
import { useUserStore } from "@/stores/user-store";
import { SessionStateReset } from "./session-state-reset";

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

  it("keeps them when the same user re-hydrates", () => {
    renderReset();
    hydrate("user-a");
    seedUserState();
    hydrate("user-a");
    expect(queryClient.getQueryData(["items"])).toBeDefined();
  });
});
