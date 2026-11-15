"use client";

import { type RefObject, useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_DENSITY,
  DENSITY_CONFIG,
  DENSITY_LEVELS,
  type DensityBreakpoint,
  type DensityLevel,
  getDensityByIndex,
  getDensityIndex,
  LG_BREAKPOINT,
  useGridDensityStore,
} from "@/stores/grid-density-store";
import { useGridPinch } from "./use-grid-pinch";

const LG_MEDIA_QUERY = `(min-width: ${LG_BREAKPOINT}px)`;

function subscribeToBreakpoint(onChange: () => void) {
  const mediaQuery = window.matchMedia(LG_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

const getBreakpoint = (): DensityBreakpoint =>
  window.matchMedia(LG_MEDIA_QUERY).matches ? "lg" : "default";
const getServerBreakpoint = (): DensityBreakpoint => "default";

// Read synchronously on the client's first render: a useState + useEffect
// version rendered the grid at the mobile frame width first, then grew it to
// the lg one a frame later on every desktop load
function useBreakpoint(): DensityBreakpoint {
  return useSyncExternalStore(
    subscribeToBreakpoint,
    getBreakpoint,
    getServerBreakpoint,
  );
}

interface UseGridDensityOptions {
  enablePinch?: boolean;
}

interface UseGridDensityReturn {
  density: DensityLevel;
  frameWidth: number;
  gap: number;
  borderRadius: number;
  fontScale: number;
  containerRef: RefObject<HTMLDivElement | null>;
  hasHydrated: boolean;
  setDensity: (density: DensityLevel) => void;
  increaseDensity: () => void;
  decreaseDensity: () => void;
  resetDensity: () => void;
}

/**
 * Manages grid density state with pinch-to-zoom support and keyboard shortcuts.
 *
 * Wraps the density store and responds to the current viewport breakpoint to
 * provide the correct CSS values for frame width, gap, border radius, and
 * font scale.
 */
export function useGridDensity(
  options: UseGridDensityOptions = {},
): UseGridDensityReturn {
  const { enablePinch = true } = options;
  const { density, setDensity, hasHydrated } = useGridDensityStore();
  const breakpoint = useBreakpoint();

  const increaseDensity = useCallback(() => {
    const currentIndex = getDensityIndex(density);
    if (currentIndex > 0) {
      setDensity(getDensityByIndex(currentIndex - 1));
    }
  }, [density, setDensity]);

  const decreaseDensity = useCallback(() => {
    const currentIndex = getDensityIndex(density);
    if (currentIndex < DENSITY_LEVELS.length - 1) {
      setDensity(getDensityByIndex(currentIndex + 1));
    }
  }, [density, setDensity]);

  const resetDensity = useCallback(() => {
    setDensity(DEFAULT_DENSITY);
  }, [setDensity]);

  const handlePinch = useCallback(
    (direction: "in" | "out") => {
      if (direction === "in") {
        increaseDensity();
      } else {
        decreaseDensity();
      }
    },
    [increaseDensity, decreaseDensity],
  );

  const { containerRef } = useGridPinch({
    onPinch: handlePinch,
    onReset: resetDensity,
    // Only enable when hydrated so effect re-runs after element mounts
    enabled: enablePinch && hasHydrated,
  });

  const config = DENSITY_CONFIG[density][breakpoint];

  return {
    density,
    frameWidth: config.frameWidth,
    gap: config.gap,
    borderRadius: config.borderRadius,
    fontScale: config.fontScale,
    containerRef,
    hasHydrated,
    setDensity,
    increaseDensity,
    decreaseDensity,
    resetDensity,
  };
}
