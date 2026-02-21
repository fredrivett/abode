"use client";

import type { MilestoneType } from "@prisma/client";
import { create } from "zustand";

export type CompletedMilestone = {
  type: MilestoneType;
  completedAt: string;
};

export type MilestoneConfig = {
  label: string;
  destination: string;
  conditional?: "has_article";
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

  setMilestones: (completed, pending, hasArticle, config) =>
    set({ completed, pending, hasArticle, config, isLoaded: true }),

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
