"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error, {
      source: "next-global-error-boundary",
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center font-sans antialiased">
        <h2 className="font-semibold text-xl">Something went wrong</h2>
        <p className="max-w-md text-gray-600">
          An unexpected error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-gray-900 px-4 py-2 font-medium text-sm text-white hover:bg-gray-800"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
