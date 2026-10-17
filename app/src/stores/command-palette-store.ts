"use client";

import { create } from "zustand";

export type CommandPalettePage = "main" | "theme" | "zoom";

type CommandPaletteState = {
  open: boolean;
  targetPage: CommandPalettePage;
  setOpen: (open: boolean) => void;
  openToPage: (page: CommandPalettePage) => void;
  uploadDialogOpen: boolean;
  /**
   * Opens/closes the upload dialog. `focusUrl` focuses the URL field even on
   * touch devices (where it isn't autofocused by default), for "Paste a link"
   * entry points
   */
  setUploadDialogOpen: (
    open: boolean,
    options?: { focusUrl?: boolean },
  ) => void;
  /** Whether the open upload dialog should focus its URL field */
  uploadDialogFocusUrl: boolean;
  /** The document scanner (opened from the upload dialog or a deep link) */
  scannerOpen: boolean;
  setScannerOpen: (open: boolean) => void;
};

/**
 * Manages command palette open/close state, the active page within the palette,
 * and the upload dialog and document scanner visibility.
 */
export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  targetPage: "main",
  setOpen: (open) => set({ open, targetPage: "main" }),
  openToPage: (page) => set({ open: true, targetPage: page }),
  uploadDialogOpen: false,
  setUploadDialogOpen: (open, options) =>
    set({
      uploadDialogOpen: open,
      uploadDialogFocusUrl: open && (options?.focusUrl ?? false),
    }),
  uploadDialogFocusUrl: false,
  scannerOpen: false,
  setScannerOpen: (open) => set({ scannerOpen: open }),
}));
