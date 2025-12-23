"use client";

import { create } from "zustand";

type UserState = {
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  invitesRemaining: number;
  setInvitesRemaining: (count: number) => void;
};

export const useUserStore = create<UserState>((set) => ({
  avatarUrl: null,
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  invitesRemaining: 0,
  setInvitesRemaining: (count) => set({ invitesRemaining: count }),
}));
