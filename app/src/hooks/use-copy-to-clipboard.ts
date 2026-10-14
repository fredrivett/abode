"use client";

import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type CopyResult,
  copyToClipboard,
  describeCopyFailure,
} from "@/lib/copy";

export type CopyStatus = "idle" | "copying" | "copied" | "failed";

// A write that settles quicker than this never shows the spinner, so the usual
// instant copy doesn't flash one; a permission prompt outlasts it
const PENDING_DELAY_MS = 150;
const DEFAULT_RESET_MS = 2000;
const DEFAULT_ERROR_MESSAGE = "Couldn't copy to clipboard";

type UseCopyToClipboardOptions = {
  /** Toast shown once the copy lands; omit for no success toast */
  successMessage?: string;
  /** Toast shown when the copy fails */
  errorMessage?: string;
  /** How long `copied` / `failed` linger before reverting to `idle` */
  resetMs?: number;
};

/**
 * Copies text and tracks the outcome, so a copy button only shows its tick
 * once the clipboard write actually landed. While the browser is still
 * deciding (e.g. a permission prompt) the status is `copying`; a denied or
 * failed write is `failed` and toasts, explaining why when the browser lets us
 * tell (e.g. clipboard permission blocked for the site).
 *
 * `copy(text)` writes via `copyToClipboard`; `track(write)` follows a caller's
 * own write that resolves to a `CopyResult`.
 *
 * @example
 * const { status, copy } = useCopyToClipboard({ successMessage: "Copied" });
 * <Button onClick={() => copy(url)}><CopyStatusIcon status={status} /></Button>
 */
export function useCopyToClipboard({
  successMessage,
  errorMessage = DEFAULT_ERROR_MESSAGE,
  resetMs = DEFAULT_RESET_MS,
}: UseCopyToClipboardOptions = {}) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  // Latest attempt wins, so a slow earlier copy can't overwrite a newer result
  const attempt = useRef(0);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    pendingTimer.current = null;
    resetTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const track = useCallback(
    async (write: () => Promise<CopyResult>): Promise<CopyResult> => {
      const current = ++attempt.current;
      clearTimers();
      pendingTimer.current = setTimeout(
        () => setStatus("copying"),
        PENDING_DELAY_MS,
      );

      const result = await write();
      if (current !== attempt.current) return result;

      clearTimers();
      setStatus(result.ok ? "copied" : "failed");
      if (result.ok) {
        if (successMessage) toast.success(successMessage);
      } else {
        posthog.capture("clipboard_copy_failed", { reason: result.reason });
        toast.error(errorMessage, {
          description: describeCopyFailure(result.reason) ?? undefined,
        });
      }
      resetTimer.current = setTimeout(() => setStatus("idle"), resetMs);
      return result;
    },
    [clearTimers, successMessage, errorMessage, resetMs],
  );

  const copy = useCallback(
    (text: string) => track(() => copyToClipboard(text)),
    [track],
  );

  return { status, copy, track };
}
