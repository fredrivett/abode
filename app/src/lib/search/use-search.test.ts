import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chipSearchState } from "./chip-search";
import { useSearch } from "./use-search";

// Controllable next/navigation mock. Return a stable instance per value — a
// fresh one each render would re-fire the [searchParams] effect and loop.
const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.params,
}));

const tagState = (value: string) => chipSearchState({ type: "tag", value });

describe("useSearch URL writes", () => {
  let replaceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nav.params = new URLSearchParams();
    vi.useFakeTimers();
    replaceSpy = vi
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    replaceSpy.mockRestore();
  });

  it("debounces the URL write by default", () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setState(tagState("vinyl"));
    });

    // Not written yet — still within the debounce window
    expect(replaceSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceSpy.mock.calls[0][2])).toContain("tag=vinyl");
  });

  it("writes the URL synchronously when immediate", () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setState(tagState("vinyl"), { immediate: true });
    });

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceSpy.mock.calls[0][2])).toContain("tag=vinyl");
  });

  it("drops a debounced write if the hook unmounts first (the chip-close bug)", () => {
    const { result, unmount } = renderHook(() => useSearch());

    act(() => {
      result.current.setState(tagState("vinyl"));
    });
    // Dialog closes -> hook unmounts before the debounce fires
    unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("still writes on unmount when immediate (the fix)", () => {
    const { result, unmount } = renderHook(() => useSearch());

    act(() => {
      result.current.setState(tagState("vinyl"), { immediate: true });
    });
    unmount();

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceSpy.mock.calls[0][2])).toContain("tag=vinyl");
  });

  it("cancels a stale pending write when the URL changes externally", () => {
    const { result, rerender } = renderHook(() => useSearch());

    // Pending debounced write (e.g. typing in the header)
    act(() => {
      result.current.setState(tagState("typed"));
    });

    // Another instance writes the URL (e.g. a chip's immediate write)
    act(() => {
      nav.params = new URLSearchParams("object=car");
      rerender();
    });

    // The stale "typed" write must not fire and clobber the new URL
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
