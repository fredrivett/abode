"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { isChunkLoadError } from "@/lib/chunk-load-error";
import { applyThemePreference, getCurrentPreference } from "@/lib/theme";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    applyThemePreference(getCurrentPreference());
  }, []);

  useEffect(() => {
    posthog.captureException(error, {
      source: "next-global-error-boundary",
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <head />
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center font-sans antialiased">
        <h2 className="font-semibold text-xl">Something went wrong</h2>
        <p className="max-w-md text-gray-600 dark:text-gray-400">
          An unexpected error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={() =>
            // A failed chunk download stays cached, so only a full reload recovers
            isChunkLoadError(error) ? window.location.reload() : retry()
          }
          className="rounded-md bg-gray-900 px-4 py-2 font-medium text-sm text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Try again
        </button>
        <p className="max-w-md text-gray-600 text-sm dark:text-gray-400">
          If the error persists, please{" "}
          <a href="mailto:fred@abode.fyi" className="underline">
            reach out
          </a>{" "}
          and we'll investigate.
        </p>
      </body>
    </html>
  );
}
