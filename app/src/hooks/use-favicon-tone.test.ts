import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FaviconTone } from "@/lib/favicon-tone";
import { useFaviconTone } from "./use-favicon-tone";

const pending = new Map<string, (tone: FaviconTone | null) => void>();
const settled = new Map<string, FaviconTone | null>();

vi.mock("@/lib/favicon-tone", () => ({
  loadFaviconTone: (src: string) =>
    new Promise((resolve) => pending.set(src, resolve)),
  settledFaviconTone: (src: string) => settled.get(src),
}));

async function resolveTone(src: string, tone: FaviconTone | null) {
  await act(async () => pending.get(src)?.(tone));
}

describe("useFaviconTone", () => {
  beforeEach(() => {
    pending.clear();
    settled.clear();
  });

  it("measures nothing without a favicon", () => {
    const { result } = renderHook(() => useFaviconTone(null));
    expect(result.current).toBeNull();
    expect(pending.size).toBe(0);
  });

  it("drops the old tone on a src change and ignores the superseded load", async () => {
    const { result, rerender } = renderHook(({ src }) => useFaviconTone(src), {
      initialProps: { src: "a.png" },
    });
    await resolveTone("a.png", "dark");
    expect(result.current).toBe("dark");

    rerender({ src: "b.png" });
    expect(result.current).toBeNull();

    rerender({ src: "c.png" });
    await resolveTone("c.png", "light");
    expect(result.current).toBe("light");

    // The superseded load finishing last must not overwrite the current tone
    await resolveTone("b.png", null);
    expect(result.current).toBe("light");
  });

  it("returns a tone measured earlier on the first render, without reloading", () => {
    settled.set("a.png", "dark");
    const { result } = renderHook(() => useFaviconTone("a.png"));
    expect(result.current).toBe("dark");
    expect(pending.size).toBe(0);
  });
});
