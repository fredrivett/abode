import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_RETRY_DELAYS_MS } from "@/lib/image-retry";
import { useImageLoaded } from "./use-image-loaded";

function fakeImg(complete: boolean, naturalWidth: number) {
  return {
    complete,
    naturalWidth,
    getAttribute: () => "a.jpg",
  } as unknown as HTMLImageElement;
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

  it("resets even when returning to a previously-loaded src", () => {
    const { result, rerender } = renderHook(({ src }) => useImageLoaded(src), {
      initialProps: { src: "a.jpg" },
    });
    act(() => result.current.imgProps.onLoad());
    expect(result.current.loaded).toBe(true);

    rerender({ src: "b.jpg" });
    rerender({ src: "a.jpg" }); // back to a URL that loaded before
    // Must show the placeholder again until the current image repaints, not
    // treat the historical load as still valid.
    expect(result.current.loaded).toBe(false);
  });

  it("stays unloaded when there is no src", () => {
    const { result } = renderHook(() => useImageLoaded(null));
    act(() => result.current.imgProps.onLoad());
    expect(result.current.loaded).toBe(false);
  });

  it("exposes the src for the <img>", () => {
    const { result } = renderHook(() => useImageLoaded("/a.jpg"));
    expect(result.current.imgProps.src).toBe("/a.jpg");
  });
});

describe("useImageLoaded retries", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const [firstDelay, secondDelay] = IMAGE_RETRY_DELAYS_MS;

  it("retries a failed same-origin load under a cache-busting URL", () => {
    const { result } = renderHook(() => useImageLoaded("/img?w=640"));

    let retrying = false;
    act(() => {
      retrying = result.current.imgProps.onError();
    });
    expect(retrying).toBe(true);
    // Not until the backoff elapses
    expect(result.current.imgProps.src).toBe("/img?w=640");

    act(() => vi.advanceTimersByTime(firstDelay));
    expect(result.current.imgProps.src).toBe("/img?w=640&retry=1");

    act(() => {
      result.current.imgProps.onError();
    });
    act(() => vi.advanceTimersByTime(secondDelay));
    expect(result.current.imgProps.src).toBe("/img?w=640&retry=2");

    act(() => result.current.imgProps.onLoad());
    expect(result.current.loaded).toBe(true);
  });

  it("gives up once the retries are spent", () => {
    const { result } = renderHook(() => useImageLoaded("/img"));
    for (const delay of IMAGE_RETRY_DELAYS_MS) {
      act(() => {
        result.current.imgProps.onError();
      });
      act(() => vi.advanceTimersByTime(delay));
    }

    let retrying = true;
    act(() => {
      retrying = result.current.imgProps.onError();
    });
    expect(retrying).toBe(false);
    act(() => vi.runAllTimers());
    expect(result.current.imgProps.src).toBe(
      `/img?retry=${IMAGE_RETRY_DELAYS_MS.length}`,
    );
  });

  it("schedules one retry for twin errors (e.g. two <img>s sharing the src)", () => {
    const { result } = renderHook(() => useImageLoaded("/img"));
    act(() => {
      result.current.imgProps.onError();
      result.current.imgProps.onError();
    });
    act(() => vi.advanceTimersByTime(firstDelay));
    expect(result.current.imgProps.src).toBe("/img?retry=1");
  });

  it("holds the placeholder through a retry even if a twin <img> already loaded", () => {
    const { result } = renderHook(() => useImageLoaded("/img"));
    act(() => result.current.imgProps.onLoad()); // first twin paints
    act(() => {
      result.current.imgProps.onError(); // second twin fails
    });
    act(() => vi.advanceTimersByTime(firstDelay));
    expect(result.current.imgProps.src).toBe("/img?retry=1");
    expect(result.current.loaded).toBe(false);
  });

  it("doesn't retry third-party URLs", () => {
    const { result } = renderHook(() =>
      useImageLoaded("https://pbs.twimg.com/a.jpg"),
    );
    let retrying = true;
    act(() => {
      retrying = result.current.imgProps.onError();
    });
    expect(retrying).toBe(false);
    act(() => vi.runAllTimers());
    expect(result.current.imgProps.src).toBe("https://pbs.twimg.com/a.jpg");
  });

  it("retries an image that already failed before React attached handlers", () => {
    const { result } = renderHook(() => useImageLoaded("/img"));
    act(() => result.current.imgProps.ref(fakeImg(true, 0)));
    act(() => vi.advanceTimersByTime(firstDelay));
    expect(result.current.imgProps.src).toBe("/img?retry=1");
  });

  it("drops a pending retry when the src changes", () => {
    const { result, rerender } = renderHook(({ src }) => useImageLoaded(src), {
      initialProps: { src: "/a" },
    });
    act(() => {
      result.current.imgProps.onError();
    });
    rerender({ src: "/b" });
    act(() => vi.runAllTimers());
    expect(result.current.imgProps.src).toBe("/b");
  });
});
