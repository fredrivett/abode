"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isCameraSupported } from "@/lib/scanner/camera";
import type { ScanPage } from "@/lib/scanner/pages";
import { useUserStore } from "@/stores/user-store";

/** The scanner (worker, camera, review) is code-split — loaded on first open */
export const LazyDocumentScanner = dynamic(
  () => import("./document-scanner").then((mod) => mod.DocumentScanner),
  { ssr: false },
);

/**
 * Whether this viewer gets the (in-progress) document scanner: admins, and
 * anyone in local dev, while it's being built out. `isAdmin` is undefined
 * until the user store hydrates — treated as no.
 */
export function canUseScanner({
  isAdmin,
  isDevelopment,
}: {
  isAdmin: boolean | undefined;
  isDevelopment: boolean;
}): boolean {
  return isDevelopment || isAdmin === true;
}

/** Whether to offer "Scan a document": viewer has access and a camera API exists */
export function useScannerAvailable(): boolean {
  const isAdmin = useUserStore((state) => state.isAdmin);
  // Camera support is only knowable in the browser
  const [cameraSupported, setCameraSupported] = useState(false);
  useEffect(() => setCameraSupported(isCameraSupported()), []);
  return (
    cameraSupported &&
    canUseScanner({
      isAdmin,
      isDevelopment: process.env.NODE_ENV === "development",
    })
  );
}

/** Saving lands with the `document` item kind; until then, report what was scanned */
export async function saveScannedPages(pages: ScanPage[]): Promise<void> {
  toast.info(
    `Scanned ${pages.length} ${pages.length === 1 ? "page" : "pages"}. Saving scans isn't available yet.`,
  );
}
