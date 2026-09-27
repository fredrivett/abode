import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScannerAvailable } from "./scanner-entry";

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
