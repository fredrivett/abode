import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chipSearchState } from "./chip-search";
import { replaceSearchParams, useSearch } from "./use-search";

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

  it("keeps other params (e.g. an open ?item=) on a debounced write", () => {
    window.history.pushState(null, "", "/dashboard?q=ca&item=abc");
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setState({ query: "cat", filters: [] });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const written = new URLSearchParams(String(replaceSpy.mock.calls[0][2]));
    expect(written.get("q")).toBe("cat");
    expect(written.get("item")).toBe("abc");
    window.history.pushState(null, "", "/");
  });

  it("replaces the whole query on an immediate write (a chip closes the dialog)", () => {
    window.history.pushState(null, "", "/dashboard?item=abc");
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setState(tagState("vinyl"), { immediate: true });
    });

    expect(String(replaceSpy.mock.calls[0][2])).toBe("?tag=vinyl");
    window.history.pushState(null, "", "/");
  });
});

describe("useSearch URL reads", () => {
  beforeEach(() => {
    nav.params = new URLSearchParams("type=image");
  });

  it("ignores URL changes outside the search params (e.g. opening an item)", () => {
    const { result, rerender } = renderHook(() => useSearch());
    const before = result.current.state;

    // Opening/closing the item dialog toggles ?item= — not a search change
    act(() => {
      nav.params = new URLSearchParams("type=image&item=abc");
      rerender();
    });
    act(() => {
      nav.params = new URLSearchParams("type=image");
      rerender();
    });

    // Same object: no re-parse, so no re-run search / reset pagination
    expect(result.current.state).toBe(before);
  });

  it("syncs when the search params change externally (back/forward)", () => {
    const { result, rerender } = renderHook(() => useSearch());

    act(() => {
      nav.params = new URLSearchParams("type=video&item=abc");
      rerender();
    });

    expect(result.current.state.filters).toMatchObject([
      { type: "type", value: "video" },
    ]);
  });
});

describe("replaceSearchParams", () => {
  it("swaps search-owned params and keeps the rest", () => {
    expect(
      replaceSearchParams({
        search: "?q=old&tag=x&item=abc&debug=1",
        state: { query: "new", filters: [] },
      }),
    ).toBe("item=abc&debug=1&q=new");
  });
});
