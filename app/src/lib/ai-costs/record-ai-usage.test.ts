import { beforeEach, describe, expect, test, vi } from "vitest";

const capture = vi.fn();
const getPostHogClient = vi.fn();
const captureServerException = vi.fn();
const accrueUsageCost = vi.fn();

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => getPostHogClient(),
  captureServerException: (...args: unknown[]) =>
    captureServerException(...args),
}));

vi.mock("@/lib/usage-limits", () => ({
  accrueUsageCost: (...args: unknown[]) => accrueUsageCost(...args),
}));

import { recordAiUsage } from "./record-ai-usage";

beforeEach(() => {
  capture.mockReset();
  getPostHogClient.mockReset();
  captureServerException.mockReset();
  accrueUsageCost.mockReset();
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

  test("prices image_filtering as a chat call", () => {
    recordAiUsage({
      userId: "user-1",
      itemId: "item-1",
      provider: "openai",
      operation: "image_filtering",
      model: "gpt-4.1-nano",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0].properties.cost_usd).toBeCloseTo(0.5, 10);
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

  test("accrues the durable cost even when PostHog capture throws", () => {
    capture.mockImplementation(() => {
      throw new Error("posthog down");
    });

    recordAiUsage({
      userId: "user-1",
      provider: "openai",
      operation: "text_embedding",
      model: "text-embedding-3-small",
      totalTokens: 1000,
      source: "ingestion",
    });

    // Accrual runs before capture, so a throwing client can't skip it.
    expect(accrueUsageCost).toHaveBeenCalledWith(
      "user-1",
      "ingestion",
      expect.any(Number),
    );
  });
});
