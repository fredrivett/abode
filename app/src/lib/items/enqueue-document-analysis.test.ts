import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/items/enqueue-user-processing", () => ({
  enqueueUserProcessing: vi.fn(),
}));
vi.mock("@/lib/items/mark-enqueue-failed", () => ({
  markItemEnqueueFailed: vi.fn(),
}));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));

import { enqueueUserProcessing } from "@/lib/items/enqueue-user-processing";
import { markItemEnqueueFailed } from "@/lib/items/mark-enqueue-failed";
import { captureServerException } from "@/lib/posthog-server";
import { enqueueDocumentAnalysis } from "./enqueue-document-analysis";

const params = { itemId: "item-1", userId: "user-1" };

beforeEach(() => vi.clearAllMocks());

describe("enqueueDocumentAnalysis", () => {
  it("enqueues analyze-document as user-initiated processing", async () => {
    await enqueueDocumentAnalysis(params);
    expect(enqueueUserProcessing).toHaveBeenCalledWith(
      "analyze-document",
      params,
      "user-1",
    );
    expect(markItemEnqueueFailed).not.toHaveBeenCalled();
  });

  it("marks the item failed, without throwing, when enqueueing fails", async () => {
    vi.mocked(enqueueUserProcessing).mockRejectedValue(new Error("offline"));
    await expect(enqueueDocumentAnalysis(params)).resolves.toBeUndefined();
    expect(markItemEnqueueFailed).toHaveBeenCalledWith({
      itemId: "item-1",
      context: "analyze-document",
    });
    expect(captureServerException).toHaveBeenCalled();
  });
});
