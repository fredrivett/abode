"use client";

import { create } from "zustand";

type CommandPaletteState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  uploadDialogOpen: boolean;
  setUploadDialogOpen: (open: boolean) => void;
};

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  uploadDialogOpen: false,
  setUploadDialogOpen: (open) => set({ uploadDialogOpen: open }),
}));
