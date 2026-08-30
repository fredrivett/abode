import { describe, expect, it, vi } from "vitest";
import { subscribeMediaQuery } from "./media-query";

describe("subscribeMediaQuery", () => {
  it("uses addEventListener/removeEventListener when available", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const mq = {
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList;
    const listener = vi.fn();

    const unsubscribe = subscribeMediaQuery(mq, listener);
    expect(addEventListener).toHaveBeenCalledWith("change", listener);

    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
  });

  it("falls back to addListener/removeListener (Safari < 14)", () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    // No addEventListener/removeEventListener on this object
    const mq = { addListener, removeListener } as unknown as MediaQueryList;
    const listener = vi.fn();

    const unsubscribe = subscribeMediaQuery(mq, listener);
    expect(addListener).toHaveBeenCalledWith(listener);

    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(listener);
  });
});
