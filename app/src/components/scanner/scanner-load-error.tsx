"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/** Full-screen notice when the scanner's code or worker fails to load */
export function ScannerLoadError({
  onRetry,
  onClose,
}: {
  onRetry: () => void;
  onClose: () => void;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);

  // It replaces whatever had focus, so move keyboard focus onto it
  useEffect(() => retryRef.current?.focus(), []);

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
        <Button ref={retryRef} variant="secondary" onClick={onRetry}>
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
