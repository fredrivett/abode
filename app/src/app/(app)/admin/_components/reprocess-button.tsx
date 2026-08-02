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
import { reprocessIssueGroupAsAdmin } from "../(protected)/actions";

export function ReprocessButton({
  groupKey,
  label,
  count,
  limit,
}: {
  groupKey: string;
  label: string;
  count: number;
  limit: number;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const batch = Math.min(count, limit);

  const run = () => {
    startTransition(async () => {
      const result = await reprocessIssueGroupAsAdmin(groupKey);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Reprocessing ${result.triggered ?? 0} items`);
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
            Re-runs the capture pipeline for the {batch} newest
            {count > limit ? ` of ${count}` : ""} item
            {batch === 1 ? "" : "s"}. This calls the AI pipeline (OpenAI +
            Replicate) and costs money — it runs at low priority behind live
            uploads. Items with no pipeline (e.g. notes) are skipped.
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
