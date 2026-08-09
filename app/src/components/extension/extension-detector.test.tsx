import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExtensionStore } from "@/stores/extension-store";
import { ExtensionDetector } from "./extension-detector";

/** A message as the content script posts it: from this window, same origin. */
function postFromContentScript(data: unknown) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data,
      source: window,
      origin: window.location.origin,
    }),
  );
}

describe("ExtensionDetector", () => {
  beforeEach(() => {
    useExtensionStore.setState({ installed: false, version: null });
  });

  it("posts a ping on mount", () => {
    const postSpy = vi.spyOn(window, "postMessage");
    render(<ExtensionDetector />);
    expect(postSpy).toHaveBeenCalledWith(
      { type: "ABODE_EXT_PING" },
      window.location.origin,
    );
    postSpy.mockRestore();
  });

  it("marks the extension installed when a pong arrives", () => {
    render(<ExtensionDetector />);
    postFromContentScript({ type: "ABODE_EXT_PONG", version: "1.2.3" });
    expect(useExtensionStore.getState().installed).toBe(true);
    expect(useExtensionStore.getState().version).toBe("1.2.3");
  });

  it("ignores messages that aren't a pong", () => {
    render(<ExtensionDetector />);
    postFromContentScript({ type: "SOMETHING_ELSE" });
    expect(useExtensionStore.getState().installed).toBe(false);
  });

  it("ignores pongs from another origin", () => {
    render(<ExtensionDetector />);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "ABODE_EXT_PONG", version: "x" },
        source: window,
        origin: "https://evil.example.com",
      }),
    );
    expect(useExtensionStore.getState().installed).toBe(false);
  });

  it("ignores pongs that don't originate from this window", () => {
    render(<ExtensionDetector />);
    // No `source` (defaults to null) → a message from an iframe/other context,
    // rejected by the source guard.
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "ABODE_EXT_PONG", version: "x" },
        origin: window.location.origin,
      }),
    );
    expect(useExtensionStore.getState().installed).toBe(false);
  });
});
