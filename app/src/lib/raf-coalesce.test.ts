import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coalesceFrame } from "./raf-coalesce";

describe("coalesceFrame", () => {
  let pending: Map<number, FrameRequestCallback>;
  let nextId: number;

  beforeEach(() => {
    pending = new Map();
    nextId = 1;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      pending.delete(id);
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const flush = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    for (const cb of callbacks) cb(0);
  };

  it("defers the callback to the next frame", () => {
    const fn = vi.fn();
    coalesceFrame(fn).schedule();
    expect(fn).not.toHaveBeenCalled();
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("coalesces multiple schedules into a single run", () => {
    const fn = vi.fn();
    const { schedule } = coalesceFrame(fn);
    schedule();
    schedule();
    schedule();
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs again on a later frame after a prior run", () => {
    const fn = vi.fn();
    const { schedule } = coalesceFrame(fn);
    schedule();
    flush();
    schedule();
    flush();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancel prevents a pending callback from running", () => {
    const fn = vi.fn();
    const { schedule, cancel } = coalesceFrame(fn);
    schedule();
    cancel();
    flush();
    expect(fn).not.toHaveBeenCalled();
  });
});
