"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

/**
 * Rendered when `/save` is opened but no usable link could be read from the
 * share — surfaces the failure (toast + message + analytics) instead of
 * silently bouncing to the dashboard.
 *
 * `rawValue` is the raw shared value we tried to parse, shown back to the user
 * to make a malformed/encoded share visible rather than mysterious.
 */
export function ShareFailed({ rawValue }: { rawValue?: string }) {
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    toast.error("Couldn't read a link from what you shared");
    posthog.capture("share_target_failed", {
      reason: "no_url",
      had_value: Boolean(rawValue),
    });
  }, [rawValue]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-medium">
        Couldn&apos;t read a link from what you shared
      </p>
      <p className="max-w-md text-muted-foreground text-sm">
        Try sharing a page or link directly.
      </p>
      <Button asChild>
        <a href={ROUTES.DASHBOARD}>Go to dashboard</a>
      </Button>
      {rawValue ? (
        <p className="max-w-md break-all text-muted-foreground text-xs">
          Received: {rawValue}
        </p>
      ) : null}
    </main>
  );
}
