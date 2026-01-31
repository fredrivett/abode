"use client";

import { create } from "zustand";

export type CommandPalettePage = "main" | "theme" | "zoom";

type CommandPaletteState = {
  open: boolean;
  targetPage: CommandPalettePage;
  setOpen: (open: boolean) => void;
  openToPage: (page: CommandPalettePage) => void;
  uploadDialogOpen: boolean;
  setUploadDialogOpen: (open: boolean) => void;
};

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  targetPage: "main",
  setOpen: (open) => set({ open, targetPage: "main" }),
  openToPage: (page) => set({ open: true, targetPage: page }),
  uploadDialogOpen: false,
  setUploadDialogOpen: (open) => set({ uploadDialogOpen: open }),
}));
