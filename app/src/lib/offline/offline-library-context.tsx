"use client";

import { createContext, useContext } from "react";
import type { OfflineItemStore } from "./item-store";

/** The signed-in user's offline library, once it holds a complete copy */
export type OfflineLibrary = {
  store: OfflineItemStore;
  /** When the last full sync round finished */
  lastSyncedAt: string;
};

export const OfflineLibraryContext = createContext<OfflineLibrary | null>(null);

/**
 * The offline library to read from while there's no connection. Null until a
 * sync round has finished at least once (a half-done first sync would show a
 * partial library as if it were the whole thing), and outside the signed-in
 * app. Provided by `OfflineLibraryProvider`.
 */
export function useOfflineLibrary(): OfflineLibrary | null {
  return useContext(OfflineLibraryContext);
}
