"use client";

import { create } from "zustand";

type UserState = {
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
};

export const useUserStore = create<UserState>((set) => ({
  avatarUrl: null,
  setAvatarUrl: (url) => set({ avatarUrl: url }),
}));
