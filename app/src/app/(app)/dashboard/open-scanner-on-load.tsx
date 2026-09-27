"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useScannerAvailable } from "@/components/scanner/scanner-entry";
import { useCommandPaletteStore } from "@/stores/command-palette-store";

/**
 * Opens the document scanner when the dashboard is loaded with `?action=scan`
 * (the onboarding checklist's "Scan your first document" link), then strips
 * the param so a refresh doesn't reopen it. Waits until the browser is known
 * to support the camera; without it, the link just lands on the dashboard.
 */
export function OpenScannerOnLoad({ action }: { action?: string }) {
  const pathname = usePathname();
  const available = useScannerAvailable();
  const setScannerOpen = useCommandPaletteStore(
    (state) => state.setScannerOpen,
  );
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || action !== "scan" || !available) return;
    handled.current = true;
    setScannerOpen(true);
    window.history.replaceState(null, "", pathname);
  }, [action, available, pathname, setScannerOpen]);

  return null;
}
