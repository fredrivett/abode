"use client";

import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";
import { createLogger } from "@/lib/logger.client";
import { ROUTES } from "@/lib/routes";
import { useMilestoneStore } from "@/stores/milestone-store";

const log = createLogger("save/save-handler");

/**
 * Auto-saves a shared URL on mount, then replaces the history entry with the
 * dashboard so back/refresh can't re-trigger the save.
 */
export function SaveHandler({ url }: { url: string }) {
  const router = useRouter();
  const invalidateItems = useInvalidateItems();
  const [status, setStatus] = useState<"saving" | "error">("saving");
  const hasSubmitted = useRef(false);

  const save = useCallback(async () => {
    setStatus("saving");
    try {
      await api.post("/api/v1/items/from-url", {
        url,
        source: "share_target",
      });
      useMilestoneStore.getState().markComplete("save_first_url");
      invalidateItems();
      toast.success("Saved to abode — processing in background");
      router.replace(ROUTES.DASHBOARD);
    } catch (error) {
      log.error({ error }, "Share target save failed");
      posthog.captureException(error);
      setStatus("error");
    }
  }, [url, router, invalidateItems]);

  useEffect(() => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    posthog.capture("share_target_opened", {
      url_domain: new URL(url).hostname,
    });
    void save();
  }, [save, url]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      {status === "saving" ? (
        <IsLoading label="Saving to abode" />
      ) : (
        <>
          <p className="font-medium">Couldn&apos;t save that link</p>
          <div className="flex gap-2">
            <Button onClick={() => void save()}>Try again</Button>
            <Button variant="outline" asChild>
              <a href={ROUTES.DASHBOARD}>Go to dashboard</a>
            </Button>
          </div>
        </>
      )}
      <p className="max-w-md break-all text-muted-foreground text-sm">{url}</p>
    </main>
  );
}
