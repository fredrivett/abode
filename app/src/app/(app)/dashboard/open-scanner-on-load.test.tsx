import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { OpenScannerOnLoad } from "./open-scanner-on-load";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

const withCamera = () =>
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });

beforeEach(() => {
  useCommandPaletteStore.setState({ scannerOpen: false });
  vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenScannerOnLoad", () => {
  it("opens the scanner for ?action=scan and strips the param", () => {
    withCamera();
    render(<OpenScannerOnLoad action="scan" />);
    expect(useCommandPaletteStore.getState().scannerOpen).toBe(true);
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/dashboard",
    );
  });

  it("does nothing for other actions", () => {
    withCamera();
    render(<OpenScannerOnLoad action="upload" />);
    render(<OpenScannerOnLoad />);
    expect(useCommandPaletteStore.getState().scannerOpen).toBe(false);
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("doesn't open without a camera API", () => {
    vi.stubGlobal("navigator", {});
    render(<OpenScannerOnLoad action="scan" />);
    expect(useCommandPaletteStore.getState().scannerOpen).toBe(false);
  });
});
