"use client";

import { ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Button } from "@/components/ui/button";
import { useCommandPaletteStore } from "./command-palette-store";

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

export const DENSITY_LABELS: Record<DensityLevel, string> = {
  micro: "Micro",
  tiny: "Tiny",
  compact: "Compact",
  dense: "Dense",
  normal: "Normal",
  spacious: "Spacious",
  large: "Large",
  xlarge: "X-Large",
  xxlarge: "XX-Large",
};

export type DensityValues = {
  frameWidth: number;
  gap: number;
  borderRadius: number;
  fontScale: number;
};

export type DensityBreakpoint = "default" | "lg";

export const DENSITY_CONFIG: Record<
  DensityLevel,
  Record<DensityBreakpoint, DensityValues>
> = {
  micro: {
    default: { frameWidth: 60, gap: 1, borderRadius: 0, fontScale: 0.55 },
    lg: { frameWidth: 100, gap: 1, borderRadius: 0, fontScale: 0.65 },
  },
  tiny: {
    default: { frameWidth: 80, gap: 2, borderRadius: 1, fontScale: 0.65 },
    lg: { frameWidth: 125, gap: 4, borderRadius: 2, fontScale: 0.75 },
  },
  compact: {
    default: { frameWidth: 100, gap: 4, borderRadius: 2, fontScale: 0.75 },
    lg: { frameWidth: 160, gap: 8, borderRadius: 4, fontScale: 0.85 },
  },
  dense: {
    default: { frameWidth: 120, gap: 6, borderRadius: 4, fontScale: 0.8 },
    lg: { frameWidth: 200, gap: 12, borderRadius: 6, fontScale: 0.9 },
  },
  normal: {
    default: { frameWidth: 150, gap: 10, borderRadius: 6, fontScale: 0.9 },
    lg: { frameWidth: 250, gap: 16, borderRadius: 8, fontScale: 1 },
  },
  spacious: {
    default: { frameWidth: 180, gap: 12, borderRadius: 8, fontScale: 1 },
    lg: { frameWidth: 320, gap: 20, borderRadius: 10, fontScale: 1.2 },
  },
  large: {
    default: { frameWidth: 240, gap: 16, borderRadius: 10, fontScale: 1.1 },
    lg: { frameWidth: 400, gap: 24, borderRadius: 12, fontScale: 1.4 },
  },
  xlarge: {
    default: { frameWidth: 300, gap: 20, borderRadius: 12, fontScale: 1.3 },
    lg: { frameWidth: 500, gap: 28, borderRadius: 14, fontScale: 1.6 },
  },
  xxlarge: {
    default: { frameWidth: 350, gap: 24, borderRadius: 14, fontScale: 1.5 },
    lg: { frameWidth: 600, gap: 32, borderRadius: 16, fontScale: 1.8 },
  },
};

// Tailwind lg breakpoint
export const LG_BREAKPOINT = 1024;

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
      setDensity: (density) => {
        set({ density });
        toast.custom(
          () => (
            <div className="flex w-full items-center justify-between gap-12 rounded-lg border bg-background p-4 shadow-lg">
              <span className="flex items-center gap-2 font-medium text-sm">
                <ZoomIn className="size-4" />
                Zoom: {DENSITY_LABELS[density]}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  toast.dismiss("zoom-level");
                  useCommandPaletteStore.getState().openToPage("zoom");
                }}
              >
                View options
              </Button>
            </div>
          ),
          {
            id: "zoom-level",
            duration: 3000,
          },
        );
      },
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
