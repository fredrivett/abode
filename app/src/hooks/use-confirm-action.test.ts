import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConfirmAction } from "./use-confirm-action";

describe("useConfirmAction", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("arms on the first click and confirms on the second", () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useConfirmAction({ onConfirm }));

    expect(result.current.confirming).toBe(false);

    act(() => result.current.onClick());
    expect(result.current.confirming).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => result.current.onClick());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(result.current.confirming).toBe(false);
  });

  it("reverts to idle once the pointer has left for the delay", () => {
    const { result } = renderHook(() =>
      useConfirmAction({ onConfirm: vi.fn(), revertDelayMs: 3000 }),
    );

    act(() => result.current.onClick());
    act(() => result.current.hoverProps.onMouseLeave());

    act(() => vi.advanceTimersByTime(2999));
    expect(result.current.confirming).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.confirming).toBe(false);
  });

  it("cancels the revert when the pointer returns before the delay", () => {
    const { result } = renderHook(() =>
      useConfirmAction({ onConfirm: vi.fn(), revertDelayMs: 3000 }),
    );

    act(() => result.current.onClick());
    act(() => result.current.hoverProps.onMouseLeave());
    act(() => vi.advanceTimersByTime(1500));
    act(() => result.current.hoverProps.onMouseEnter());
    act(() => vi.advanceTimersByTime(5000));

    expect(result.current.confirming).toBe(true);
  });

  it("leaving an unarmed control never arms or schedules a revert", () => {
    const { result } = renderHook(() =>
      useConfirmAction({ onConfirm: vi.fn() }),
    );

    act(() => result.current.hoverProps.onMouseLeave());
    act(() => vi.advanceTimersByTime(5000));

    expect(result.current.confirming).toBe(false);
  });

  it("reset() disarms immediately and cancels a pending revert", () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useConfirmAction({ onConfirm }));

    act(() => result.current.onClick());
    act(() => result.current.hoverProps.onMouseLeave());
    act(() => result.current.reset());
    expect(result.current.confirming).toBe(false);

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.confirming).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
