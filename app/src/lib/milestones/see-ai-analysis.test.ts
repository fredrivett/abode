import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMilestoneStore } from "@/stores/milestone-store";
import { completeSeeAiAnalysisOnOpen } from "./see-ai-analysis";

const post = vi.fn();
vi.mock("@/lib/api-client", () => ({
  api: { post: (...a: unknown[]) => post(...a) },
}));

const isComplete = () =>
  useMilestoneStore
    .getState()
    .completed.some((m) => m.type === "see_ai_analysis");

describe("completeSeeAiAnalysisOnOpen", () => {
  beforeEach(() => {
    post.mockResolvedValue({});
    useMilestoneStore.setState({ completed: [], pending: ["see_ai_analysis"] });
  });

  afterEach(() => {
    post.mockReset();
  });

  it("completes and persists the milestone for the viewer's own analysed item", () => {
    completeSeeAiAnalysisOnOpen({
      canEdit: true,
      processingStatus: "completed",
    });

    expect(isComplete()).toBe(true);
    expect(post).toHaveBeenCalledWith("/api/v1/user/milestones", {
      type: "see_ai_analysis",
    });
  });

  it("skips items the viewer can't edit (e.g. a visitor on a public room)", () => {
    completeSeeAiAnalysisOnOpen({
      canEdit: false,
      processingStatus: "completed",
    });

    expect(isComplete()).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it("skips items whose analysis hasn't finished", () => {
    completeSeeAiAnalysisOnOpen({ canEdit: true, processingStatus: "pending" });

    expect(isComplete()).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it("swallows a failed persist instead of leaving an unhandled rejection", async () => {
    const rejection = Promise.reject(new Error("Unauthorized"));
    const caught = vi.spyOn(rejection, "catch");
    post.mockReturnValue(rejection);

    completeSeeAiAnalysisOnOpen({
      canEdit: true,
      processingStatus: "completed",
    });

    expect(caught).toHaveBeenCalled();
    await expect(caught.mock.results[0]?.value).resolves.toBeUndefined();
  });
});
