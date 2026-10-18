import { describe, expect, it } from "vitest";
import { currentViewerFrame, recordViewer } from "@/lib/viewer-context";
import { withViewer } from "./with-viewer";

describe("withViewer", () => {
  it("runs each call in its own frame, anonymous until the caller is recorded", async () => {
    const handler = withViewer(async (viewerId: string | null) => {
      const before = currentViewerFrame()?.viewerId;
      if (viewerId) recordViewer(viewerId);
      return { before, after: currentViewerFrame()?.viewerId };
    });

    expect(await handler("user-1")).toEqual({ before: null, after: "user-1" });
    // A second request doesn't inherit the first one's viewer
    expect(await handler(null)).toEqual({ before: null, after: null });
    expect(currentViewerFrame()).toBeUndefined();
  });

  it("keeps overlapping requests apart", async () => {
    const handler = withViewer(async (viewerId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      recordViewer(viewerId);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return currentViewerFrame()?.viewerId;
    });

    expect(await Promise.all([handler("a"), handler("b")])).toEqual(["a", "b"]);
  });
});
