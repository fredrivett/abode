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
  /** Whose milestones these are; undefined = not loaded yet */
  userId: string | undefined;
  completed: CompletedMilestone[];
  pending: MilestoneType[];
  hasArticle: boolean;
  config: Record<MilestoneType, MilestoneConfig> | null;

  setMilestones: (data: MilestonesResponse & { userId: string }) => void;

  markComplete: (type: MilestoneType) => void;
};

/**
 * Manages onboarding milestone progress -- which milestones have been completed,
 * which are still pending, and their display configuration. Keyed by user: the
 * store outlives sign-out/sign-in (soft navigations), so another user's
 * milestones replace the last user's rather than merging into them.
 */
export const useMilestoneStore = create<MilestoneState>((set) => ({
  userId: undefined,
  completed: [],
  pending: [],
  hasArticle: false,
  config: null,

  // Milestones never un-complete, so for the same user a completion already
  // shown here (marked optimistically) survives a server response that
  // predates its write
  setMilestones: ({ userId, completed, pending, hasArticle, config }) =>
    set((state) => {
      const serverCompleted = new Set(completed.map((m) => m.type));
      const localOnly =
        state.userId === userId
          ? state.completed.filter((m) => !serverCompleted.has(m.type))
          : [];
      const localTypes = new Set(localOnly.map((m) => m.type));
      return {
        userId,
        completed: [...completed, ...localOnly],
        pending: pending.filter((type) => !localTypes.has(type)),
        hasArticle,
        config,
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

let lastStartedRefresh = 0;
let lastAppliedRefresh = 0;

/**
 * Fetches the signed-in user's milestones into the store. Safe to call
 * repeatedly (e.g. each time the checklist opens): a response older than one
 * already applied is dropped, and a failure leaves what's shown in place —
 * the checklist is non-critical.
 */
export async function refreshMilestones(userId: string): Promise<void> {
  const refresh = ++lastStartedRefresh;
  try {
    const response = await fetch("/api/v1/user/milestones");
    if (!response.ok) return;
    const data: MilestonesResponse = await response.json();
    if (refresh < lastAppliedRefresh) return;
    lastAppliedRefresh = refresh;
    useMilestoneStore.getState().setMilestones({ ...data, userId });
  } catch {
    // Keep showing the last known state
  }
}
