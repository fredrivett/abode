"use client";

import { type RefObject, useCallback, useEffect, useRef } from "react";

type PinchDirection = "in" | "out";

interface UseGridPinchOptions {
  onPinch: (direction: PinchDirection) => void;
  onReset?: () => void;
  threshold?: number;
  enabled?: boolean;
}

interface UseGridPinchReturn {
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Detects pinch-to-zoom gestures and keyboard zoom shortcuts on a container element.
 *
 * Handles trackpad pinch (via ctrlKey + wheel), touch pinch, and Cmd/Ctrl +/-/0
 * shortcuts. Scale deltas are accumulated and only fire the callback once the
 * threshold is crossed. Returns a ref to attach to the target container.
 */
export function useGridPinch({
  onPinch,
  onReset,
  threshold = 0.15,
  enabled = true,
}: UseGridPinchOptions): UseGridPinchReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scaleAccumulator = useRef(0);
  const lastTouchDistance = useRef<number | null>(null);

  const handlePinchDelta = useCallback(
    (delta: number) => {
      scaleAccumulator.current += delta;

      if (scaleAccumulator.current >= threshold) {
        scaleAccumulator.current = 0;
        onPinch("out");
      } else if (scaleAccumulator.current <= -threshold) {
        scaleAccumulator.current = 0;
        onPinch("in");
      }
    },
    [onPinch, threshold],
  );

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Chrome on Mac fires wheel events with ctrlKey for trackpad pinch
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * 0.01;
      handlePinchDelta(delta);
    };

    const getTouchDistance = (touches: TouchList): number => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastTouchDistance.current = getTouchDistance(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches);
        const delta = (currentDistance - lastTouchDistance.current) / 200;
        lastTouchDistance.current = currentDistance;
        handlePinchDelta(delta);
      }
    };

    const handleTouchEnd = () => {
      lastTouchDistance.current = null;
    };

    // Keyboard shortcuts: Cmd/Ctrl + Plus/Minus/Zero
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // Plus: = or + (with shift)
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        onPinch("out"); // Larger items
      }
      // Minus: -
      else if (e.key === "-") {
        e.preventDefault();
        onPinch("in"); // Smaller items
      }
      // Zero: reset to default
      else if (e.key === "0" && onReset) {
        e.preventDefault();
        onReset();
      }
    };

    // Use capture phase to intercept before browser handles zoom
    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });
    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);
    // Keyboard events on document to work regardless of focus
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true });
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handlePinchDelta, onPinch, onReset]);

  return { containerRef };
}
