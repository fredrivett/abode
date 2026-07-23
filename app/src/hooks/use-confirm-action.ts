"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// How long the armed state lingers after the pointer leaves before reverting
const DEFAULT_REVERT_DELAY_MS = 3000;

type UseConfirmActionOptions = {
  /** Runs on the confirming (second) click */
  onConfirm: () => void;
  /**
   * How long the armed state persists after the pointer leaves the control
   * before reverting to idle. Set to 0 to revert as soon as the pointer leaves.
   * Defaults to 3000ms.
   */
  revertDelayMs?: number;
};

type ConfirmAction = {
  /** True once armed — awaiting the confirming second click */
  confirming: boolean;
  /** Click handler: arms on the first click, runs `onConfirm` on the second */
  onClick: () => void;
  /** Spread onto the control so leaving it reverts the armed state */
  hoverProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  /** Force back to idle (e.g. when the underlying content changes) */
  reset: () => void;
};

/**
 * Two-step "click to confirm" for a single control, guarding a destructive
 * action against an accidental click.
 *
 * The first click arms the control — the caller swaps its label/style based on
 * `confirming` — and the second runs `onConfirm`. An armed control reverts to
 * idle after the pointer has left it for `revertDelayMs` (spread `hoverProps`
 * onto the control), or immediately via `reset()` (e.g. when the underlying
 * content changes). Presentation is entirely the caller's — this owns only the
 * arm/confirm/revert state machine.
 *
 * @example
 * const clear = useConfirmAction({ onConfirm: handleClear });
 * <Button onClick={clear.onClick} {...clear.hoverProps}>
 *   {clear.confirming ? "Confirm clear" : "Clear"}
 * </Button>
 */
export function useConfirmAction({
  onConfirm,
  revertDelayMs = DEFAULT_REVERT_DELAY_MS,
}: UseConfirmActionOptions): ConfirmAction {
  const [confirming, setConfirming] = useState(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (revertTimer.current) {
      clearTimeout(revertTimer.current);
      revertTimer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setConfirming(false);
  }, [clearTimer]);

  // Clear any pending revert on unmount
  useEffect(() => clearTimer, [clearTimer]);

  const onClick = useCallback(() => {
    if (confirming) {
      clearTimer();
      setConfirming(false);
      onConfirm();
    } else {
      setConfirming(true);
    }
  }, [confirming, clearTimer, onConfirm]);

  const scheduleRevert = useCallback(() => {
    clearTimer();
    revertTimer.current = setTimeout(() => setConfirming(false), revertDelayMs);
  }, [clearTimer, revertDelayMs]);

  const hoverProps = useMemo(
    () => ({
      onMouseEnter: clearTimer,
      onMouseLeave: () => {
        if (confirming) scheduleRevert();
      },
    }),
    [confirming, clearTimer, scheduleRevert],
  );

  return { confirming, onClick, hoverProps, reset };
}
