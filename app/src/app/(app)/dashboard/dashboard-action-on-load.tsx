"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useScannerAvailable } from "@/components/scanner/scanner-entry";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSearchFocusStore } from "@/stores/search-focus-store";

const DASHBOARD_ACTIONS = ["scan", "upload", "search"] as const;
type DashboardAction = (typeof DASHBOARD_ACTIONS)[number];

export function isDashboardAction(
  value: string | null | undefined,
): value is DashboardAction {
  return DASHBOARD_ACTIONS.some((action) => action === value);
}

function runAction(action: DashboardAction) {
  switch (action) {
    case "scan":
      useCommandPaletteStore.getState().setScannerOpen(true);
      return;
    case "upload":
      useCommandPaletteStore.getState().setUploadDialogOpen(true);
      return;
    case "search":
      useSearchFocusStore.getState().requestFilterPrompt();
      return;
  }
}

/**
 * Runs the dashboard deep-link `?action=` (the onboarding checklist's links),
 * then strips the param so a refresh doesn't repeat it:
 * - `scan` opens the document scanner — once the browser is known to support
 *   the camera; without it, the link just lands on the dashboard
 * - `upload` opens the add-item dialog
 * - `search` focuses the search and opens its `@` filter list
 *
 * Read from the client URL rather than the page's props so that stripping the
 * param ends the action, and a later link while already on the dashboard (a
 * soft navigation) runs again.
 */
export function DashboardActionOnLoad() {
  const pathname = usePathname();
  const action = useSearchParams().get("action");
  const scannerAvailable = useScannerAvailable();

  useEffect(() => {
    if (!isDashboardAction(action)) return;
    if (action === "scan" && !scannerAvailable) return;
    runAction(action);
    // Drop only `action`, keeping anything else (e.g. an open `?item=`)
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState(
      null,
      "",
      `${pathname}${url.search}${url.hash}`,
    );
  }, [action, scannerAvailable, pathname]);

  return null;
}
