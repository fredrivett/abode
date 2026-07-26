import { describe, expect, test } from "vitest";
import {
  googleVisionCostUsd,
  KNOWN_AI_MODELS,
  openAiChatCostUsd,
  openAiEmbeddingCostUsd,
  replicateImageCostUsd,
} from "./prices";

describe("openAiEmbeddingCostUsd", () => {
  test("computes cost from tokens", () => {
    // 1M tokens at $0.02/1M = $0.02
    expect(openAiEmbeddingCostUsd("text-embedding-3-small", 1_000_000)).toBe(
      0.02,
    );
    expect(openAiEmbeddingCostUsd("text-embedding-3-small", 500_000)).toBe(
      0.01,
    );
  });

  test("returns null for an unknown model", () => {
    expect(openAiEmbeddingCostUsd("text-embedding-9-huge", 1000)).toBeNull();
  });
});

describe("openAiChatCostUsd", () => {
  test("computes cost from input + output tokens", () => {
    // 1M input @ $0.15 + 1M output @ $0.60 = $0.75
    expect(openAiChatCostUsd("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(
      0.75,
      10,
    );
  });

  test("prices gpt-4.1-nano (product-image filtering)", () => {
    // 1M input @ $0.10 + 1M output @ $0.40 = $0.50
    expect(openAiChatCostUsd("gpt-4.1-nano", 1_000_000, 1_000_000)).toBeCloseTo(
      0.5,
      10,
    );
  });

  test("resolves dated model variants via prefix match", () => {
    expect(
      openAiChatCostUsd("gpt-4o-mini-2024-07-18", 1_000_000, 0),
    ).toBeCloseTo(0.15, 10);
  });

  test("returns null for an unknown model", () => {
    expect(openAiChatCostUsd("gpt-5-turbo", 1000, 1000)).toBeNull();
  });
});

describe("replicateImageCostUsd", () => {
  test("computes flat per-image cost", () => {
    expect(replicateImageCostUsd("clip-vit-base-patch32", 1)).toBe(0.00022);
    expect(replicateImageCostUsd("clip-vit-base-patch32", 3)).toBeCloseTo(
      0.00066,
      10,
    );
  });

  test("returns null for an unknown model", () => {
    expect(replicateImageCostUsd("some-other-model")).toBeNull();
  });
});

describe("googleVisionCostUsd", () => {
  test("computes per-feature cost from unit count", () => {
    // 1000 images at $1.50/1000 = $1.50
    expect(googleVisionCostUsd("IMAGE_PROPERTIES", 1000)).toBe(1.5);
    expect(googleVisionCostUsd("IMAGE_PROPERTIES", 1)).toBeCloseTo(0.0015, 10);
  });

  test("returns null for an unknown feature", () => {
    expect(googleVisionCostUsd("FACE_DETECTION")).toBeNull();
  });
});

describe("KNOWN_AI_MODELS coverage guard", () => {
  // Fails CI if the code calls a model that lacks a price entry.
  test("every known embedding model resolves to a non-null price", () => {
    for (const model of KNOWN_AI_MODELS.openAiEmbedding) {
      expect(openAiEmbeddingCostUsd(model, 1000)).not.toBeNull();
    }
  });

  test("every known chat model resolves to a non-null price", () => {
    for (const model of KNOWN_AI_MODELS.openAiChat) {
      expect(openAiChatCostUsd(model, 1000, 1000)).not.toBeNull();
    }
  });

  test("every known replicate model resolves to a non-null price", () => {
    for (const model of KNOWN_AI_MODELS.replicate) {
      expect(replicateImageCostUsd(model)).not.toBeNull();
    }
  });

  test("every known google vision feature resolves to a non-null price", () => {
    for (const feature of KNOWN_AI_MODELS.googleVision) {
      expect(googleVisionCostUsd(feature)).not.toBeNull();
    }
  });
});
