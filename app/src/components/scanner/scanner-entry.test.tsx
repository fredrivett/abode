import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LazyDocumentScanner, useScannerAvailable } from "./scanner-entry";

const chunk = vi.hoisted(() => ({ failuresLeft: 0 }));

vi.mock("posthog-js", () => ({ default: { captureException: vi.fn() } }));

// A throwing getter rejects the lazy import, as a failed chunk download does
vi.mock("./document-scanner", () => ({
  get DocumentScanner() {
    if (chunk.failuresLeft > 0) {
      chunk.failuresLeft--;
      const error = new Error("Loading chunk 8560 failed.");
      error.name = "ChunkLoadError";
      throw error;
    }
    return () => <div>Scanner ready</div>;
  },
}));

describe("LazyDocumentScanner", () => {
  beforeEach(() => {
    chunk.failuresLeft = 0;
    // React logs the error the boundary catches
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  function renderScanner() {
    const onOpenChange = vi.fn();
    render(
      <LazyDocumentScanner
        open
        onOpenChange={onOpenChange}
        onSave={vi.fn(async () => true)}
      />,
    );
    return { onOpenChange };
  }

  it("renders the scanner once its chunk loads", async () => {
    renderScanner();
    expect(await screen.findByText("Scanner ready")).toBeInTheDocument();
  });

  it("contains a failed chunk load and retries it", async () => {
    chunk.failuresLeft = 1;
    renderScanner();

    expect(
      await screen.findByText("Couldn't open the scanner"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Scanner ready")).toBeInTheDocument();
  });

  it("closes from the error state", async () => {
    chunk.failuresLeft = 1;
    const { onOpenChange } = renderScanner();

    await userEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("useScannerAvailable", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers the scanner when the browser can open a camera", () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
    const { result } = renderHook(() => useScannerAvailable());
    expect(result.current).toBe(true);
  });

  it("hides it without a camera API (e.g. an insecure context)", () => {
    vi.stubGlobal("navigator", {});
    const { result } = renderHook(() => useScannerAvailable());
    expect(result.current).toBe(false);
  });
});
