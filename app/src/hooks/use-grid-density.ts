"use client";

import { useCallback } from "react";
import {
  DEFAULT_DENSITY,
  DENSITY_CONFIG,
  DENSITY_LEVELS,
  type DensityLevel,
  getDensityByIndex,
  getDensityIndex,
  useGridDensityStore,
} from "@/stores/grid-density-store";
import { useGridPinch } from "./use-grid-pinch";

interface UseGridDensityOptions {
  enablePinch?: boolean;
}

interface UseGridDensityReturn {
  density: DensityLevel;
  frameWidth: number;
  gap: number;
  borderRadius: number;
  fontScale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  hasHydrated: boolean;
  setDensity: (density: DensityLevel) => void;
  increaseDensity: () => void;
  decreaseDensity: () => void;
  resetDensity: () => void;
}

export function useGridDensity(
  options: UseGridDensityOptions = {},
): UseGridDensityReturn {
  const { enablePinch = true } = options;
  const { density, setDensity, hasHydrated } = useGridDensityStore();

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

  const config = DENSITY_CONFIG[density];

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
