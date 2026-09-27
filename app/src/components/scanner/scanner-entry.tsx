"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { IsLoading } from "@/components/ui/is-loading";
import { isCameraSupported } from "@/lib/scanner/camera";
import { useUserStore } from "@/stores/user-store";

/** Full-screen placeholder while the scanner chunk downloads on first open */
function ScannerLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white/80">
      <IsLoading label="Opening scanner" />
    </div>
  );
}

/** The scanner (worker, camera, review) is code-split — loaded on first open */
export const LazyDocumentScanner = dynamic(
  () => import("./document-scanner").then((mod) => mod.DocumentScanner),
  { ssr: false, loading: ScannerLoading },
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
