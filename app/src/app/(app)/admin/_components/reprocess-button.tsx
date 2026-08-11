"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import type { RepairStrategy } from "@/lib/admin/processing-issues";
import { reprocessIssueGroupAsAdmin } from "../(protected)/actions";

export function ReprocessButton({
  groupKey,
  label,
  count,
  limit,
  repair,
}: {
  groupKey: string;
  label: string;
  count: number;
  limit: number;
  repair: RepairStrategy;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const batch = Math.min(count, limit);
  const scope = `${batch} newest${count > limit ? ` of ${count}` : ""} item${
    batch === 1 ? "" : "s"
  }`;

  const run = () => {
    startTransition(async () => {
      const result = await reprocessIssueGroupAsAdmin(groupKey);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const monitorUrl = result.monitorUrl;
      toast.success(`Reprocessing ${result.triggered ?? 0} items`, {
        description: "Runs in the background — this may take a few minutes.",
        duration: 10000,
        action: monitorUrl
          ? {
              label: "Monitor ↗",
              onClick: () =>
                window.open(monitorUrl, "_blank", "noopener,noreferrer"),
            }
          : undefined,
      });
      router.refresh();
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? <IsLoading label="Reprocessing" /> : `Reprocess ${batch}`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reprocess {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            {repair === "blur" ? (
              <>
                Regenerates just the blur placeholder for the {scope} locally
                (sharp) — no AI calls, no cost. Runs in the background; only the
                placeholder changes.
              </>
            ) : (
              <>
                Re-runs the capture pipeline for the {scope}. This calls the AI
                pipeline (OpenAI + Replicate) and costs money — it shares the
                capture queue with live uploads. Items with no pipeline (e.g.
                notes) are skipped.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={run}>Reprocess</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
