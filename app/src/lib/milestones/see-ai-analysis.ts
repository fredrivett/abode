import { api } from "@/lib/api-client";
import { shouldCompleteSeeAiAnalysis } from "@/lib/milestones/conditions";
import { useMilestoneStore } from "@/stores/milestone-store";

/**
 * Completes the see_ai_analysis milestone when the viewer opens one of their
 * own analysed items. Skipped for items they can't edit: a visitor on a public
 * room has no milestones, and the POST would 401.
 */
export function completeSeeAiAnalysisOnOpen({
  canEdit,
  processingStatus,
}: {
  canEdit: boolean;
  processingStatus: string | undefined;
}) {
  if (!canEdit || !shouldCompleteSeeAiAnalysis(processingStatus)) return;

  useMilestoneStore.getState().markComplete("see_ai_analysis");
  // Fire-and-forget: a failed persist must not surface as an unhandled rejection
  api
    .post("/api/v1/user/milestones", { type: "see_ai_analysis" })
    .catch(() => {});
}
