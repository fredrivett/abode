import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEBUG_STORAGE_KEY } from "@/lib/debug/debug-flag";
import { resetTrace } from "@/lib/debug/test-utils";
import { isTracing } from "@/lib/debug/trace";
import { useUserStore } from "@/stores/user-store";
import { DebugTools, debugToolsAccess } from "./debug-tools";

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockDebugSession() {
      return <div data-testid="debug-session" />;
    },
}));

describe("debugToolsAccess", () => {
  it.each([
    [true, false, "allowed"],
    [false, false, "denied"],
    [undefined, false, "pending"],
    [false, true, "allowed"],
    [undefined, true, "allowed"],
  ] as const)("isAdmin=%s dev=%s → %s", (isAdmin, isDevelopment, expected) => {
    expect(debugToolsAccess({ isAdmin, isDevelopment })).toBe(expected);
  });
});

describe("DebugTools", () => {
  afterEach(() => {
    window.localStorage.removeItem(DEBUG_STORAGE_KEY);
    useUserStore.setState({ isAdmin: undefined });
  });

  it("renders the session for an admin with the flag on", () => {
    window.localStorage.setItem(DEBUG_STORAGE_KEY, "1");
    useUserStore.setState({ isAdmin: true });
    const { queryByTestId } = render(<DebugTools />);
    expect(queryByTestId("debug-session")).toBeInTheDocument();
  });

  it("renders nothing when the flag is off", () => {
    useUserStore.setState({ isAdmin: true });
    const { queryByTestId } = render(<DebugTools />);
    expect(queryByTestId("debug-session")).not.toBeInTheDocument();
  });

  it("renders nothing for a non-admin outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    window.localStorage.setItem(DEBUG_STORAGE_KEY, "1");
    useUserStore.setState({ isAdmin: false });
    const { queryByTestId } = render(<DebugTools />);
    expect(queryByTestId("debug-session")).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("stops recording once the viewer is known not to be an admin", () => {
    vi.stubEnv("NODE_ENV", "production");
    resetTrace();
    useUserStore.setState({ isAdmin: undefined });
    const { rerender } = render(<DebugTools />);
    // Still unknown (header not hydrated yet) — keep recording
    expect(isTracing()).toBe(true);
    useUserStore.setState({ isAdmin: false });
    rerender(<DebugTools />);
    expect(isTracing()).toBe(false);
    vi.unstubAllEnvs();
  });
});
