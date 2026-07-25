import { beforeEach, describe, expect, test, vi } from "vitest";

const capture = vi.fn();
const getPostHogClient = vi.fn();
const captureServerException = vi.fn();

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => getPostHogClient(),
  captureServerException: (...args: unknown[]) =>
    captureServerException(...args),
}));

import { recordAiUsage } from "./record-ai-usage";

beforeEach(() => {
  capture.mockReset();
  getPostHogClient.mockReset();
  captureServerException.mockReset();
  getPostHogClient.mockReturnValue({ capture });
});

describe("recordAiUsage", () => {
  test("captures ai_usage with the computed cost_usd", () => {
    recordAiUsage({
      userId: "user-1",
      itemId: "item-1",
      provider: "openai",
      operation: "text_embedding",
      model: "text-embedding-3-small",
      totalTokens: 1_000_000,
    });

    expect(capture).toHaveBeenCalledTimes(1);
    const arg = capture.mock.calls[0][0];
    expect(arg.event).toBe("ai_usage");
    expect(arg.distinctId).toBe("user-1");
    expect(arg.properties.cost_usd).toBe(0.02);
    expect(arg.properties.provider).toBe("openai");
    expect(arg.properties.tokens_total).toBe(1_000_000);
    expect(arg.properties.item_id).toBe("item-1");
    expect(arg.properties.source).toBe("ingestion");
  });

  test("emits cost_usd: null for an unknown model", () => {
    recordAiUsage({
      userId: "user-1",
      provider: "openai",
      operation: "text_embedding",
      model: "text-embedding-unpriced",
      totalTokens: 1000,
    });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0].properties.cost_usd).toBeNull();
  });

  test("no-ops without throwing when PostHog is unconfigured", () => {
    getPostHogClient.mockReturnValue(null);

    expect(() =>
      recordAiUsage({
        userId: "user-1",
        provider: "replicate",
        operation: "image_embedding",
        model: "clip-vit-base-patch32",
        images: 1,
      }),
    ).not.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });

  test("swallows errors when capture throws and reports them", () => {
    capture.mockImplementation(() => {
      throw new Error("posthog down");
    });

    expect(() =>
      recordAiUsage({
        userId: "user-1",
        provider: "google_vision",
        operation: "vision_analysis",
        model: "IMAGE_PROPERTIES",
        images: 1,
      }),
    ).not.toThrow();
    expect(captureServerException).toHaveBeenCalledTimes(1);
  });
});
