"use client";

import { create } from "zustand";
import type { AuthenticatedUser } from "@/lib/user";

// Hydration data - all fields optional since we only hydrate what hasn't been set
type UserHydrationData = Partial<Omit<AuthenticatedUser, "id">>;

type UserState = {
  // User profile fields
  // undefined = not yet hydrated, null = explicitly no value
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  username: string | null | undefined;
  email: string | null | undefined;
  avatarUrl: string | null | undefined;
  availableInvites: number | undefined;

  // Individual setters for mutations
  setFirstName: (name: string | null) => void;
  setLastName: (name: string | null) => void;
  setUsername: (username: string | null) => void;
  setEmail: (email: string | null) => void;
  setAvatarUrl: (url: string | null) => void;
  setAvailableInvites: (count: number) => void;

  // Bulk hydration from server - only hydrates fields that haven't been set yet
  hydrateUser: (data: UserHydrationData) => void;
};

export const useUserStore = create<UserState>((set, get) => ({
  firstName: undefined,
  lastName: undefined,
  username: undefined,
  email: undefined,
  avatarUrl: undefined,
  availableInvites: undefined,

  setFirstName: (name) => set({ firstName: name }),
  setLastName: (name) => set({ lastName: name }),
  setUsername: (username) => set({ username }),
  setEmail: (email) => set({ email }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setAvailableInvites: (count) => set({ availableInvites: count }),

  hydrateUser: (data) => {
    const state = get();
    const updates: Partial<UserState> = {};

    // Only hydrate fields that haven't been set yet (undefined = not hydrated)
    if (state.firstName === undefined && data.firstName !== undefined) {
      updates.firstName = data.firstName ?? null;
    }
    if (state.lastName === undefined && data.lastName !== undefined) {
      updates.lastName = data.lastName ?? null;
    }
    if (state.username === undefined && data.username !== undefined) {
      updates.username = data.username ?? null;
    }
    if (state.email === undefined && data.email !== undefined) {
      updates.email = data.email ?? null;
    }
    if (state.avatarUrl === undefined && data.avatarUrl !== undefined) {
      updates.avatarUrl = data.avatarUrl ?? null;
    }
    if (state.availableInvites === undefined && data.availableInvites !== undefined) {
      updates.availableInvites = data.availableInvites;
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },
}));
