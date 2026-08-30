import { describe, expect, it } from "vitest";
import type { ImageVisionAnalysis } from "./analyze-image-bytes";
import { buildImageDetailsUpdate } from "./image-details-write";

function analysis(
  overrides: Partial<ImageVisionAnalysis> = {},
): ImageVisionAnalysis {
  return {
    title: "T",
    description: "D",
    objects: ["chair"],
    ocrText: "hello",
    tags: ["furniture"],
    colors: [{ name: "red", hex: "#ff0000" }],
    visionData: {
      source: "hybrid",
      openai: {
        model: "gpt-x",
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      },
      visionApiFeatures: ["IMAGE_PROPERTIES"],
    },
    embedding: null,
    embeddingModel: null,
    blurDataUrl: "data:image/webp;base64,AA==",
    openaiConfigured: true,
    ...overrides,
  };
}

describe("buildImageDetailsUpdate", () => {
  it("writes all fields when OpenAI + colours are present", () => {
    const update = buildImageDetailsUpdate(analysis(), new Date(0));

    expect(update.objects).toEqual(["chair"]);
    expect(update.ocrText).toBe("hello");
    expect(update.visionData).toBeDefined();
    expect(update.colors).toBeDefined();
    expect(update.blurDataUrl).toBe("data:image/webp;base64,AA==");
    expect(update.captureDate).toEqual(new Date(0));
  });

  it("omits OpenAI-derived fields when unconfigured so a reprocess can't wipe them", () => {
    const update = buildImageDetailsUpdate(
      analysis({
        openaiConfigured: false,
        objects: [],
        ocrText: null,
        visionData: {
          source: "hybrid",
          openai: null,
          visionApiFeatures: ["IMAGE_PROPERTIES"],
        },
      }),
      null,
    );

    // Preserved (not present in the update payload)
    expect(update).not.toHaveProperty("objects");
    expect(update).not.toHaveProperty("ocrText");
    expect(update).not.toHaveProperty("visionData");
    // Colours still refresh (Google Vision produced them); deterministic fields too
    expect(update.colors).toBeDefined();
    expect(update.blurDataUrl).toBe("data:image/webp;base64,AA==");
  });

  it("omits colours when none were produced (Google Vision skipped/empty)", () => {
    const update = buildImageDetailsUpdate(analysis({ colors: [] }), null);

    expect(update).not.toHaveProperty("colors");
    // OpenAI fields still written (configured)
    expect(update.objects).toEqual(["chair"]);
  });
});
