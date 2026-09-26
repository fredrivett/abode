"use client";

import { create } from "zustand";
import type { AuthenticatedUser } from "@/lib/user";

// Hydration data - profile fields optional since we only hydrate what hasn't
// been set; the id says whose data it is
type UserHydrationData = Partial<Omit<AuthenticatedUser, "id">> & {
  userId: string;
};

type UserProfile = {
  /** Whose profile this is; undefined = nobody hydrated (or signed out) */
  userId: string | undefined;
  // User profile fields
  // undefined = not yet hydrated, null = explicitly no value
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  username: string | null | undefined;
  email: string | null | undefined;
  avatarUrl: string | null | undefined;
  availableInvites: number | undefined;
  isAdmin: boolean | undefined;
};

type UserState = UserProfile & {
  // Individual setters for mutations
  setFirstName: (name: string | null) => void;
  setLastName: (name: string | null) => void;
  setUsername: (username: string | null) => void;
  setEmail: (email: string | null) => void;
  setAvatarUrl: (url: string | null) => void;
  setAvailableInvites: (count: number) => void;

  // Bulk hydration from server - only hydrates fields that haven't been set yet
  hydrateUser: (data: UserHydrationData) => void;
  /** Forget the signed-in user (sign-out) */
  clearUser: () => void;
};

const EMPTY_PROFILE: UserProfile = {
  userId: undefined,
  firstName: undefined,
  lastName: undefined,
  username: undefined,
  email: undefined,
  avatarUrl: undefined,
  availableInvites: undefined,
  isAdmin: undefined,
};

/**
 * Manages the authenticated user's profile fields on the client.
 *
 * Fields use a three-state model: `undefined` means not yet hydrated from the
 * server, `null` means explicitly empty, and a string/number is the actual value.
 * `hydrateUser` only fills in fields that are still `undefined`, so client-side
 * mutations made before hydration are preserved — for the same user. The store
 * outlives sign-out/sign-in (they're soft navigations), so hydrating a
 * different user replaces the whole profile rather than inheriting the last
 * user's fields (e.g. `isAdmin`).
 */
export const useUserStore = create<UserState>((set, get) => ({
  ...EMPTY_PROFILE,

  setFirstName: (name) => set({ firstName: name }),
  setLastName: (name) => set({ lastName: name }),
  setUsername: (username) => set({ username }),
  setEmail: (email) => set({ email }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setAvailableInvites: (count) => set({ availableInvites: count }),

  clearUser: () => set(EMPTY_PROFILE),

  hydrateUser: (data) => {
    // A different user starts from an empty profile
    const state = get().userId === data.userId ? get() : EMPTY_PROFILE;
    const updates: Partial<UserState> = {};
    if (state.userId !== data.userId) {
      Object.assign(updates, EMPTY_PROFILE, { userId: data.userId });
    }

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
    if (
      state.availableInvites === undefined &&
      data.availableInvites !== undefined
    ) {
      updates.availableInvites = data.availableInvites;
    }
    if (state.isAdmin === undefined && data.isAdmin !== undefined) {
      updates.isAdmin = data.isAdmin;
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },
}));
