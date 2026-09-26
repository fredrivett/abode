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

  it("writes the URL synchronously for applySearch", () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.applySearch(tagState("vinyl"));
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

  it("still writes on unmount with applySearch (the fix)", () => {
    const { result, unmount } = renderHook(() => useSearch());

    act(() => {
      result.current.applySearch(tagState("vinyl"));
    });
    unmount();

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceSpy.mock.calls[0][2])).toContain("tag=vinyl");
  });

  it("keeps params it doesn't own (e.g. an open ?item=) on a typed write", () => {
    window.history.pushState(null, "", "/dashboard?q=ca&item=abc&debug=1");
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
    expect(written.get("debug")).toBe("1");
    window.history.pushState(null, "", "/");
  });

  it("closes an open item when applying a new search, keeping other params", () => {
    window.history.pushState(null, "", "/dashboard?q=old&item=abc&debug=1");
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.applySearch(tagState("vinyl"));
    });

    const written = new URLSearchParams(String(replaceSpy.mock.calls[0][2]));
    expect(written.get("item")).toBeNull();
    expect(written.get("q")).toBeNull();
    expect(written.get("tag")).toBe("vinyl");
    expect(written.get("debug")).toBe("1");
    window.history.pushState(null, "", "/");
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

  it("doesn't mistake its own write for an external change when filter order differs", () => {
    vi.useFakeTimers();
    const replaceSpy = vi
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {});
    nav.params = new URLSearchParams();
    const { result, rerender } = renderHook(() => useSearch());

    // Added tag before type — FILTER_TYPES orders type first when parsing
    const state = {
      query: "",
      filters: [
        { id: "1", type: "tag" as const, value: "x", negated: false },
        { id: "2", type: "type" as const, value: "image", negated: false },
      ],
    };
    act(() => {
      result.current.applySearch(state);
    });
    const written = String(replaceSpy.mock.calls[0][2]).slice(1);

    // Next reflects our own write back through useSearchParams
    act(() => {
      nav.params = new URLSearchParams(written);
      rerender();
    });

    // Still our state object: not re-parsed (which would re-run the search)
    expect(result.current.state).toBe(state);
    replaceSpy.mockRestore();
    vi.useRealTimers();
  });
});
