import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserStore } from "@/stores/user-store";
import { PostHogIdentity } from "./posthog-identity";

const posthog = vi.hoisted(() => ({
  __loaded: true,
  distinctId: "anon-1",
  identified: false,
  identify: vi.fn(),
  reset: vi.fn(),
  get_distinct_id: () => posthog.distinctId,
  _isIdentified: () => posthog.identified,
}));

vi.mock("posthog-js", () => ({ default: posthog }));

const hydrate = (userId: string) =>
  act(() => useUserStore.getState().hydrateUser({ userId }));

describe("PostHogIdentity", () => {
  beforeEach(() => {
    posthog.__loaded = true;
    posthog.distinctId = "anon-1";
    posthog.identified = false;
    posthog.identify.mockClear();
    posthog.reset.mockClear();
    useUserStore.getState().clearUser();
  });

  afterEach(() => {
    useUserStore.getState().clearUser();
  });

  it("identifies the user once they hydrate", () => {
    render(<PostHogIdentity />);
    expect(posthog.identify).not.toHaveBeenCalled();
    hydrate("user-a");
    expect(posthog.identify).toHaveBeenCalledWith("user-a");
    expect(posthog.reset).not.toHaveBeenCalled();
  });

  it("skips identify when already identified as the user", () => {
    posthog.distinctId = "user-a";
    render(<PostHogIdentity />);
    hydrate("user-a");
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it("resets on sign-out", () => {
    render(<PostHogIdentity />);
    hydrate("user-a");
    act(() => useUserStore.getState().clearUser());
    expect(posthog.reset).toHaveBeenCalledOnce();
  });

  it("resets then identifies when a different user hydrates", () => {
    render(<PostHogIdentity />);
    hydrate("user-a");
    posthog.distinctId = "user-a";
    posthog.identified = true;
    hydrate("user-b");
    expect(posthog.reset).toHaveBeenCalledOnce();
    expect(posthog.identify).toHaveBeenLastCalledWith("user-b");
    expect(posthog.reset.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.identify.mock.invocationCallOrder.at(-1) ?? 0,
    );
  });

  it("resets a previous user's persisted identity before identifying", () => {
    posthog.distinctId = "user-a";
    posthog.identified = true;
    render(<PostHogIdentity />);
    hydrate("user-b");
    expect(posthog.reset).toHaveBeenCalledOnce();
    expect(posthog.identify).toHaveBeenCalledWith("user-b");
    expect(posthog.reset.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.identify.mock.invocationCallOrder[0],
    );
  });

  it("does nothing when PostHog isn't initialised", () => {
    posthog.__loaded = false;
    render(<PostHogIdentity />);
    hydrate("user-a");
    act(() => useUserStore.getState().clearUser());
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.reset).not.toHaveBeenCalled();
  });
});
