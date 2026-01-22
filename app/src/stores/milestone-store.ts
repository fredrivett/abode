"use client";

import type { MilestoneType } from "@prisma/client";
import { create } from "zustand";

type MilestoneState = {
  completed: MilestoneType[];
  pending: MilestoneType[];
  hasArticle: boolean;
  isLoaded: boolean;

  setMilestones: (
    completed: MilestoneType[],
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
        state.completed.includes(type) ||
        !state.pending.includes(type)
      ) {
        return state;
      }

      return {
        completed: [...state.completed, type],
        pending: state.pending.filter((t) => t !== type),
      };
    }),
}));
