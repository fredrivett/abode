import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chipSearchState } from "./chip-search";
import { useSearch } from "./use-search";

// useSearch reads the URL via next/navigation's useSearchParams. Return a
// stable instance — a fresh one each render would re-fire the [searchParams]
// effect and loop forever.
vi.mock("next/navigation", () => {
  const params = new URLSearchParams();
  return { useSearchParams: () => params };
});

// The debounce is 300ms; wait comfortably past it
const PAST_DEBOUNCE_MS = 400;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useSearch URL writes", () => {
  let replaceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    replaceSpy = vi
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    replaceSpy.mockRestore();
  });

  it("debounces the URL write by default", async () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setState(chipSearchState({ type: "tag", value: "vinyl" }));
    });

    // Not written yet — still within the debounce window
    expect(replaceSpy).not.toHaveBeenCalled();

    await act(async () => {
      await wait(PAST_DEBOUNCE_MS);
    });

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceSpy.mock.calls[0][2])).toContain("tag=vinyl");
  });

  it("writes the URL synchronously when immediate", () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setState(
        chipSearchState({ type: "tag", value: "vinyl" }),
        {
          immediate: true,
        },
      );
    });

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceSpy.mock.calls[0][2])).toContain("tag=vinyl");
  });

  it("drops a debounced write if the hook unmounts first (the chip-close bug)", async () => {
    const { result, unmount } = renderHook(() => useSearch());

    act(() => {
      result.current.setState(chipSearchState({ type: "tag", value: "vinyl" }));
    });
    // Dialog closes -> hook unmounts before the debounce fires
    unmount();

    await wait(PAST_DEBOUNCE_MS);

    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("still writes on unmount when immediate (the fix)", () => {
    const { result, unmount } = renderHook(() => useSearch());

    act(() => {
      result.current.setState(
        chipSearchState({ type: "tag", value: "vinyl" }),
        {
          immediate: true,
        },
      );
    });
    unmount();

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceSpy.mock.calls[0][2])).toContain("tag=vinyl");
  });
});
