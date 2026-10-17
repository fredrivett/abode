"use client";

import type { MilestoneType } from "@prisma/client";
import { create } from "zustand";
import type { MilestoneConditional } from "@/lib/milestones/conditions";

export type CompletedMilestone = {
  type: MilestoneType;
  completedAt: string;
};

export type MilestoneConfig = {
  label: string;
  destination: string;
  conditional?: MilestoneConditional;
};

type MilestonesResponse = {
  completed: CompletedMilestone[];
  pending: MilestoneType[];
  hasArticle: boolean;
  config: Record<MilestoneType, MilestoneConfig>;
};

type MilestoneState = {
  completed: CompletedMilestone[];
  pending: MilestoneType[];
  hasArticle: boolean;
  isLoaded: boolean;
  config: Record<MilestoneType, MilestoneConfig> | null;

  setMilestones: (
    completed: CompletedMilestone[],
    pending: MilestoneType[],
    hasArticle: boolean,
    config: Record<MilestoneType, MilestoneConfig>,
  ) => void;

  markComplete: (type: MilestoneType) => void;
};

/**
 * Manages onboarding milestone progress -- which milestones have been completed,
 * which are still pending, and their display configuration.
 */
export const useMilestoneStore = create<MilestoneState>((set) => ({
  completed: [],
  pending: [],
  hasArticle: false,
  isLoaded: false,
  config: null,

  // Milestones never un-complete, so a completion already shown here (marked
  // optimistically) survives a server response that predates its write
  setMilestones: (completed, pending, hasArticle, config) =>
    set((state) => {
      const serverCompleted = new Set(completed.map((m) => m.type));
      const localOnly = state.completed.filter(
        (m) => !serverCompleted.has(m.type),
      );
      const localTypes = new Set(localOnly.map((m) => m.type));
      return {
        completed: [...completed, ...localOnly],
        pending: pending.filter((type) => !localTypes.has(type)),
        hasArticle,
        config,
        isLoaded: true,
      };
    }),

  markComplete: (type) =>
    set((state) => {
      // Skip if already completed or not in pending
      if (
        state.completed.some((m) => m.type === type) ||
        !state.pending.includes(type)
      ) {
        return state;
      }

      return {
        completed: [
          ...state.completed,
          { type, completedAt: new Date().toISOString() },
        ],
        pending: state.pending.filter((t) => t !== type),
      };
    }),
}));

let latestRefresh = 0;

/**
 * Fetches the user's milestones into the store. Safe to call repeatedly (e.g.
 * each time the checklist opens): only the latest call's response is applied,
 * and a failure leaves what's shown in place — the checklist is non-critical.
 */
export async function refreshMilestones(): Promise<void> {
  const refresh = ++latestRefresh;
  try {
    const response = await fetch("/api/v1/user/milestones");
    if (!response.ok) return;
    const data: MilestonesResponse = await response.json();
    if (refresh !== latestRefresh) return;
    useMilestoneStore
      .getState()
      .setMilestones(
        data.completed,
        data.pending,
        data.hasArticle,
        data.config,
      );
  } catch {
    // Keep showing the last known state
  }
}
