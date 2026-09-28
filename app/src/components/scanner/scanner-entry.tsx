"use client";

import {
  type ComponentProps,
  lazy,
  Suspense,
  useEffect,
  useState,
} from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { isCameraSupported } from "@/lib/scanner/camera";
import type { DocumentScanner } from "./document-scanner";

type DocumentScannerProps = ComponentProps<typeof DocumentScanner>;

/** Full-screen placeholder while the scanner chunk downloads on first open */
function ScannerLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white/80">
      <IsLoading label="Opening scanner" />
    </div>
  );
}

export function ScannerLoadError({
  onRetry,
  onClose,
}: {
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black p-8 text-center text-white"
    >
      <h2 className="font-semibold text-lg">Couldn't open the scanner</h2>
      <p className="max-w-sm text-sm text-white/70">
        This is usually a patchy connection. Check your signal and try again.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  );
}

const loadDocumentScanner = () =>
  import("./document-scanner").then((mod) => ({
    default: mod.DocumentScanner,
  }));

/**
 * The scanner (worker, camera, review) is code-split — loaded on first open.
 * A failed download (e.g. patchy mobile data) is contained here rather than
 * crashing the page, and "Try again" re-requests the chunk: `lazy` caches a
 * rejected import forever, so retrying means a fresh `lazy`.
 */
export function LazyDocumentScanner(props: DocumentScannerProps) {
  const [attempt, setAttempt] = useState(0);
  const [Scanner, setScanner] = useState(() => lazy(loadDocumentScanner));

  const retry = () => {
    setScanner(() => lazy(loadDocumentScanner));
    setAttempt((current) => current + 1);
  };

  return (
    <ErrorBoundary
      key={attempt}
      fallback={
        <ScannerLoadError
          onRetry={retry}
          onClose={() => props.onOpenChange(false)}
        />
      }
    >
      <Suspense fallback={<ScannerLoading />}>
        <Scanner {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

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
