import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OfflinePage from "./page";

function stubLocation(hash: string) {
  const location = { hash, reload: vi.fn(), replace: vi.fn() };
  vi.stubGlobal("location", location);
  return location;
}

describe("OfflinePage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reloads the page it stood in for once back online", () => {
    const location = stubLocation("");
    render(<OfflinePage />);
    expect(
      screen.getByText(/reload once you're back online/),
    ).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(location.reload).toHaveBeenCalledOnce();
  });

  it("says a queued share is saved for later, and goes to the dashboard when online", () => {
    const location = stubLocation("#share-queued");
    const postMessage = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: { postMessage } },
    });
    render(<OfflinePage />);
    expect(screen.getByText(/link is saved for later/)).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(postMessage).toHaveBeenCalledWith({ type: "replay-share-queue" });
    expect(location.replace).toHaveBeenCalledWith("/dashboard");
    expect(location.reload).not.toHaveBeenCalled();
  });
});
