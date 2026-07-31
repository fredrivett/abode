import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useImageLoaded } from "./use-image-loaded";

function fakeImg(complete: boolean, naturalWidth: number) {
  return { complete, naturalWidth } as unknown as HTMLImageElement;
}

describe("useImageLoaded", () => {
  it("starts unloaded and flips true on load", () => {
    const { result } = renderHook(() => useImageLoaded("a.jpg"));
    expect(result.current.loaded).toBe(false);
    act(() => result.current.imgProps.onLoad());
    expect(result.current.loaded).toBe(true);
  });

  it("detects an already-cached image via the ref", () => {
    const { result } = renderHook(() => useImageLoaded("a.jpg"));
    act(() => result.current.imgProps.ref(fakeImg(true, 200)));
    expect(result.current.loaded).toBe(true);
  });

  it("stays unloaded for an incomplete image ref", () => {
    const { result } = renderHook(() => useImageLoaded("a.jpg"));
    act(() => result.current.imgProps.ref(fakeImg(false, 0)));
    expect(result.current.loaded).toBe(false);
  });

  it("resets when the src changes", () => {
    const { result, rerender } = renderHook(({ src }) => useImageLoaded(src), {
      initialProps: { src: "a.jpg" },
    });
    act(() => result.current.imgProps.onLoad());
    expect(result.current.loaded).toBe(true);

    rerender({ src: "b.jpg" });
    expect(result.current.loaded).toBe(false);
  });

  it("stays unloaded when there is no src", () => {
    const { result } = renderHook(() => useImageLoaded(null));
    act(() => result.current.imgProps.onLoad());
    expect(result.current.loaded).toBe(false);
  });
});
