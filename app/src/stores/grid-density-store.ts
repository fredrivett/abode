"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DENSITY_LEVELS = [
  "micro",
  "tiny",
  "compact",
  "dense",
  "normal",
  "spacious",
  "large",
  "xlarge",
  "xxlarge",
] as const;

export type DensityLevel = (typeof DENSITY_LEVELS)[number];

export const DENSITY_CONFIG: Record<
  DensityLevel,
  { frameWidth: number; gap: number; borderRadius: number; fontScale: number }
> = {
  micro: { frameWidth: 100, gap: 1, borderRadius: 0, fontScale: 0.65 },
  tiny: { frameWidth: 125, gap: 4, borderRadius: 2, fontScale: 0.75 },
  compact: { frameWidth: 160, gap: 8, borderRadius: 4, fontScale: 0.85 },
  dense: { frameWidth: 200, gap: 12, borderRadius: 6, fontScale: 0.9 },
  normal: { frameWidth: 250, gap: 16, borderRadius: 8, fontScale: 1 },
  spacious: { frameWidth: 320, gap: 20, borderRadius: 10, fontScale: 1.2 },
  large: { frameWidth: 400, gap: 24, borderRadius: 12, fontScale: 1.4 },
  xlarge: { frameWidth: 500, gap: 28, borderRadius: 14, fontScale: 1.6 },
  xxlarge: { frameWidth: 600, gap: 32, borderRadius: 16, fontScale: 1.8 },
};

export const DEFAULT_DENSITY: DensityLevel = "normal";

type GridDensityState = {
  density: DensityLevel;
  hasHydrated: boolean;
  setDensity: (density: DensityLevel) => void;
  setHasHydrated: (hydrated: boolean) => void;
};

export const useGridDensityStore = create<GridDensityState>()(
  persist(
    (set) => ({
      density: DEFAULT_DENSITY,
      hasHydrated: false,
      setDensity: (density) => set({ density }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: "abode:grid-density",
      partialize: (state) => ({ density: state.density }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export function getDensityIndex(density: DensityLevel): number {
  return DENSITY_LEVELS.indexOf(density);
}

export function getDensityByIndex(index: number): DensityLevel {
  const clamped = Math.max(0, Math.min(index, DENSITY_LEVELS.length - 1));
  return DENSITY_LEVELS[clamped];
}
