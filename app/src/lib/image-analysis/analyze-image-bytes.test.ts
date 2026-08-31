import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../vision", () => ({
  analyzeImageColorsOnly: vi.fn(),
  isGoogleVisionConfigured: vi.fn(),
}));
vi.mock("./openai-vision", () => ({ analyzeImageWithOpenAI: vi.fn() }));
vi.mock("../embeddings", () => ({
  isOpenAiConfigured: vi.fn(),
  isReplicateConfigured: vi.fn(),
  generateImageEmbedding: vi.fn(),
  VISUAL_EMBEDDING_MODEL: "clip-vit-base-patch32",
}));
vi.mock("../ai-costs/record-ai-usage", () => ({ recordAiUsage: vi.fn() }));
vi.mock("../posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("./embedding-failure", () => ({
  reportImageEmbeddingFailure: vi.fn(),
}));

import { recordAiUsage } from "../ai-costs/record-ai-usage";
import {
  generateImageEmbedding,
  isOpenAiConfigured,
  isReplicateConfigured,
} from "../embeddings";
import { captureServerException } from "../posthog-server";
import { analyzeImageColorsOnly, isGoogleVisionConfigured } from "../vision";
import { analyzeImageBytes } from "./analyze-image-bytes";
import { reportImageEmbeddingFailure } from "./embedding-failure";
import { analyzeImageWithOpenAI } from "./openai-vision";

const openai = vi.mocked(analyzeImageWithOpenAI);
const colors = vi.mocked(analyzeImageColorsOnly);
const replicateConfigured = vi.mocked(isReplicateConfigured);
const openaiConfigured = vi.mocked(isOpenAiConfigured);
const googleVisionConfigured = vi.mocked(isGoogleVisionConfigured);
const embed = vi.mocked(generateImageEmbedding);

function baseParams(
  getSignedUrl = vi.fn().mockResolvedValue("https://signed"),
) {
  return {
    buffer: Buffer.from("img"),
    mimeType: "image/jpeg",
    itemId: "item-1",
    userId: "user-1",
    source: "upload" as const,
    getSignedUrl,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  openaiConfigured.mockReturnValue(true);
  googleVisionConfigured.mockReturnValue(true);
  colors.mockResolvedValue(
    [] as Awaited<ReturnType<typeof analyzeImageColorsOnly>>,
  );
  openai.mockResolvedValue({
    analysis: {
      title: "T",
      description: "D",
      tags: ["a"],
      objects: ["chair"],
      ocrText: "text",
    },
    model: "gpt-x",
    usage: { promptTokens: 1, completionTokens: 2 },
  } as Awaited<ReturnType<typeof analyzeImageWithOpenAI>>);
});

describe("analyzeImageBytes", () => {
  it("returns vision output and no embedding when Replicate is unconfigured", async () => {
    replicateConfigured.mockReturnValue(false);
    const getSignedUrl = vi.fn().mockResolvedValue("https://signed");

    const result = await analyzeImageBytes(baseParams(getSignedUrl));

    expect(result.objects).toEqual(["chair"]);
    expect(result.tags).toEqual(["a"]);
    expect(result.ocrText).toBe("text");
    expect(result.embedding).toBeNull();
    expect(result.embeddingModel).toBeNull();
    // No signed URL / embedding work when we're going to skip it
    expect(getSignedUrl).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
  });

  it("generates and returns a CLIP embedding when Replicate is configured", async () => {
    replicateConfigured.mockReturnValue(true);
    embed.mockResolvedValue([0.1, 0.2, 0.3]);

    const result = await analyzeImageBytes(baseParams());

    expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(result.embeddingModel).toBe("clip-vit-base-patch32");
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "replicate" }),
    );
  });

  it("degrades gracefully to a null embedding when the CLIP call throws", async () => {
    replicateConfigured.mockReturnValue(true);
    embed.mockRejectedValue(new Error("replicate down"));

    const result = await analyzeImageBytes(baseParams());

    expect(result.embedding).toBeNull();
    expect(result.embeddingModel).toBeNull();
    // Vision output is still returned — one optional service failing isn't fatal
    expect(result.objects).toEqual(["chair"]);
    // Failure is reported (queryable event + exception) with attributable source
    expect(reportImageEmbeddingFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "item-1",
        source: "upload",
        phase: "initial",
      }),
    );
  });

  it("skips OpenAI vision cleanly when unconfigured", async () => {
    openaiConfigured.mockReturnValue(false);
    replicateConfigured.mockReturnValue(false);

    const result = await analyzeImageBytes(baseParams());

    // Vision-derived fields come back empty, not thrown
    expect(result.openaiConfigured).toBe(false);
    expect(result.title).toBe("");
    expect(result.description).toBe("");
    expect(result.tags).toEqual([]);
    expect(result.objects).toEqual([]);
    expect(result.ocrText).toBeNull();
    expect(result.visionData.openai).toBeNull();
    // The OpenAI call is never made and no OpenAI usage is billed
    expect(openai).not.toHaveBeenCalled();
    expect(recordAiUsage).not.toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai" }),
    );
  });

  it("still returns colours + blur when OpenAI is unconfigured", async () => {
    openaiConfigured.mockReturnValue(false);
    replicateConfigured.mockReturnValue(false);
    colors.mockResolvedValue([{ name: "red", hex: "#ff0000" }] as Awaited<
      ReturnType<typeof analyzeImageColorsOnly>
    >);

    const result = await analyzeImageBytes(baseParams());

    expect(result.colors).toEqual([{ name: "red", hex: "#ff0000" }]);
    expect(result.visionData.visionApiFeatures).toEqual(["IMAGE_PROPERTIES"]);
  });

  it("skips colour analysis cleanly when Google Vision is unconfigured", async () => {
    googleVisionConfigured.mockReturnValue(false);
    replicateConfigured.mockReturnValue(false);

    const result = await analyzeImageBytes(baseParams());

    expect(result.colors).toEqual([]);
    expect(result.colorsAnalyzed).toBe(false);
    expect(result.visionData.visionApiFeatures).toEqual([]);
    expect(colors).not.toHaveBeenCalled();
    // OpenAI vision still ran
    expect(result.objects).toEqual(["chair"]);
  });

  it("degrades to empty colours when the Google Vision call throws", async () => {
    replicateConfigured.mockReturnValue(false);
    colors.mockRejectedValue(new Error("vision down"));

    const result = await analyzeImageBytes(baseParams());

    expect(result.colors).toEqual([]);
    // analyzed=false so a reprocess preserves any prior palette rather than wiping
    expect(result.colorsAnalyzed).toBe(false);
    // The rest of the analysis is unaffected — one optional service isn't fatal
    expect(result.objects).toEqual(["chair"]);
    expect(captureServerException).toHaveBeenCalled();
  });

  it("marks colours analyzed even when Google Vision returns an empty palette", async () => {
    replicateConfigured.mockReturnValue(false);
    colors.mockResolvedValue(
      [] as Awaited<ReturnType<typeof analyzeImageColorsOnly>>,
    );

    const result = await analyzeImageBytes(baseParams());

    // Successful-empty: distinct from skipped/failed, so a reprocess clears stale
    expect(result.colors).toEqual([]);
    expect(result.colorsAnalyzed).toBe(true);
    expect(result.visionData.visionApiFeatures).toEqual(["IMAGE_PROPERTIES"]);
  });
});
