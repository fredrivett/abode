"use client";

import type { MilestoneType } from "@prisma/client";
import { create } from "zustand";

export type CompletedMilestone = {
  type: MilestoneType;
  completedAt: string;
};

type MilestoneState = {
  completed: CompletedMilestone[];
  pending: MilestoneType[];
  hasArticle: boolean;
  isLoaded: boolean;

  setMilestones: (
    completed: CompletedMilestone[],
    pending: MilestoneType[],
    hasArticle: boolean,
  ) => void;

  markComplete: (type: MilestoneType) => void;
};

export const useMilestoneStore = create<MilestoneState>((set) => ({
  completed: [],
  pending: [],
  hasArticle: false,
  isLoaded: false,

  setMilestones: (completed, pending, hasArticle) =>
    set({ completed, pending, hasArticle, isLoaded: true }),

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
