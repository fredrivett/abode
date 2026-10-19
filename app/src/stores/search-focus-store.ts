"use client";

import { create } from "zustand";

type SearchFocusState = {
  /**
   * Asks the page's main search input (the one with `focusShortcut`) to focus
   * and open its filter list. A flag rather than an event so a request made
   * before the input mounts is still picked up.
   */
  filterPromptRequested: boolean;
  requestFilterPrompt: () => void;
  clearFilterPromptRequest: () => void;
};

/** Lets code outside the search input (e.g. a deep link) put focus in it */
export const useSearchFocusStore = create<SearchFocusState>((set) => ({
  filterPromptRequested: false,
  requestFilterPrompt: () => set({ filterPromptRequested: true }),
  clearFilterPromptRequest: () => set({ filterPromptRequested: false }),
}));
