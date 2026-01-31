"use client";

import { useCallback, useEffect, useRef } from "react";

type PinchDirection = "in" | "out";

interface UseGridPinchOptions {
  onPinch: (direction: PinchDirection) => void;
  onReset?: () => void;
  threshold?: number;
  enabled?: boolean;
}

interface UseGridPinchReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function triggerHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

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
        triggerHaptic();
        onPinch("out");
      } else if (scaleAccumulator.current <= -threshold) {
        scaleAccumulator.current = 0;
        triggerHaptic();
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

    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      const gestureEvent = e as unknown as { scale: number };
      const scale = gestureEvent.scale;
      const delta = (scale - 1) * 0.5;
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
        triggerHaptic();
        onPinch("out"); // Larger items
      }
      // Minus: -
      else if (e.key === "-") {
        e.preventDefault();
        triggerHaptic();
        onPinch("in"); // Smaller items
      }
      // Zero: reset to default
      else if (e.key === "0" && onReset) {
        e.preventDefault();
        triggerHaptic();
        onReset();
      }
    };

    // Use capture phase to intercept before browser handles zoom
    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });
    container.addEventListener("gesturestart", handleGestureStart, {
      passive: false,
    });
    container.addEventListener("gesturechange", handleGestureChange, {
      passive: false,
    });
    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    // Keyboard events on document to work regardless of focus
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true });
      container.removeEventListener("gesturestart", handleGestureStart);
      container.removeEventListener("gesturechange", handleGestureChange);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handlePinchDelta, onPinch, onReset]);

  return { containerRef };
}
