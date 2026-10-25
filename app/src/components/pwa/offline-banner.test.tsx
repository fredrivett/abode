import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "./offline-banner";

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture } }));

function goOffline(offline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(!offline);
  act(() => {
    window.dispatchEvent(new Event(offline ? "offline" : "online"));
  });
}

describe("OfflineBanner", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("stays hidden while online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("appears when the connection drops and goes when it's back", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);

    goOffline(true);
    expect(screen.getByRole("status")).toHaveTextContent(/you're offline/i);
    expect(capture).toHaveBeenCalledWith("offline_banner_shown");

    goOffline(false);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows straight away on a page loaded offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
