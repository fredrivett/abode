import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../vision", () => ({ analyzeImageColorsOnly: vi.fn() }));
vi.mock("./openai-vision", () => ({ analyzeImageWithOpenAI: vi.fn() }));
vi.mock("../embeddings", () => ({
  isReplicateConfigured: vi.fn(),
  generateImageEmbedding: vi.fn(),
  VISUAL_EMBEDDING_MODEL: "clip-vit-base-patch32",
}));
vi.mock("../ai-costs/record-ai-usage", () => ({ recordAiUsage: vi.fn() }));
vi.mock("../posthog-server", () => ({ captureServerException: vi.fn() }));

import { recordAiUsage } from "../ai-costs/record-ai-usage";
import { generateImageEmbedding, isReplicateConfigured } from "../embeddings";
import { captureServerException } from "../posthog-server";
import { analyzeImageColorsOnly } from "../vision";
import { analyzeImageBytes } from "./analyze-image-bytes";
import { analyzeImageWithOpenAI } from "./openai-vision";

const openai = vi.mocked(analyzeImageWithOpenAI);
const colors = vi.mocked(analyzeImageColorsOnly);
const replicateConfigured = vi.mocked(isReplicateConfigured);
const embed = vi.mocked(generateImageEmbedding);

function baseParams(
  getSignedUrl = vi.fn().mockResolvedValue("https://signed"),
) {
  return {
    buffer: Buffer.from("img"),
    mimeType: "image/jpeg",
    itemId: "item-1",
    userId: "user-1",
    getSignedUrl,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(captureServerException).toHaveBeenCalled();
  });
});
