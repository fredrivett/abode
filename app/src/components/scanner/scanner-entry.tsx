"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { IsLoading } from "@/components/ui/is-loading";
import { isCameraSupported } from "@/lib/scanner/camera";

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
 * Whether to offer "Scan a document": the browser can open a camera (not, for
 * example, an insecure context). Only knowable in the browser, so it's false
 * during SSR and the first render.
 */
export function useScannerAvailable(): boolean {
  const [cameraSupported, setCameraSupported] = useState(false);
  useEffect(() => setCameraSupported(isCameraSupported()), []);
  return cameraSupported;
}
