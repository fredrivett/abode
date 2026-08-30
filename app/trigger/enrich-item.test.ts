import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the side-effecting edges (db, Trigger SDK, OpenAI calls) and keep the
// pure enrichment control flow real, so these tests exercise the actual
// decision: when OpenAI is unconfigured, does enrichment skip cleanly and still
// mark the item completed (not failed, not stuck) without any OpenAI call?
const {
  mockItemUpdate,
  mockItemUpdateMany,
  mockTrigger,
  mockMarkProcessingActive,
  mockGenerateTags,
  mockGenerateTextEmbedding,
  mockUpsertTextVector,
  mockIsOpenAiConfigured,
  mockRecordAiUsage,
  mockCapture,
} = vi.hoisted(() => ({
  mockItemUpdate: vi.fn(),
  mockItemUpdateMany: vi.fn(),
  mockTrigger: vi.fn(),
  mockMarkProcessingActive: vi.fn(),
  mockGenerateTags: vi.fn(),
  mockGenerateTextEmbedding: vi.fn(),
  mockUpsertTextVector: vi.fn(),
  mockIsOpenAiConfigured: vi.fn(),
  mockRecordAiUsage: vi.fn(),
  mockCapture: vi.fn(),
}));

// task() returns its config so `enrichItemTask.run(payload)` is the real run fn.
vi.mock("@trigger.dev/sdk", () => ({
  task: (config: unknown) => config,
  tasks: { trigger: mockTrigger },
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../src/lib/db", () => ({
  default: {
    item: { update: mockItemUpdate, updateMany: mockItemUpdateMany },
  },
}));

vi.mock("../src/lib/embeddings", () => ({
  generateTextEmbedding: mockGenerateTextEmbedding,
  isOpenAiConfigured: mockIsOpenAiConfigured,
  upsertTextVector: mockUpsertTextVector,
}));

vi.mock("../src/lib/ai/generate-tags-from-content", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/lib/ai/generate-tags-from-content")
  >()),
  generateTagsFromText: mockGenerateTags,
}));

vi.mock("../src/lib/items/mark-processing-active", () => ({
  markProcessingActive: mockMarkProcessingActive,
}));

vi.mock("../src/lib/ai-costs/record-ai-usage", () => ({
  recordAiUsage: mockRecordAiUsage,
}));

vi.mock("../src/lib/posthog-server", () => ({
  captureServerException: mockCapture,
}));

import { enrichItemTask } from "./enrich-item";

type TaskWithRun = {
  run: (payload: Record<string, unknown>) => Promise<unknown>;
};
const run = (payload: Record<string, unknown>) =>
  (enrichItemTask as unknown as TaskWithRun).run(payload);

const ITEM = { itemId: "item-1", userId: "user-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockItemUpdate.mockResolvedValue({});
  mockItemUpdateMany.mockResolvedValue({});
  mockTrigger.mockResolvedValue({});
  mockMarkProcessingActive.mockResolvedValue(undefined);
});

describe("enrichItemTask", () => {
  it("skips tag generation and text embedding cleanly when OpenAI is unconfigured", async () => {
    mockIsOpenAiConfigured.mockReturnValue(false);

    // A URL-style payload: source text but no precomputed tags — the branch that
    // would otherwise call generateTagsFromText + generateTextEmbedding.
    const result = await run({ ...ITEM, sourceText: "some article text" });

    // No OpenAI work happened
    expect(mockGenerateTags).not.toHaveBeenCalled();
    expect(mockGenerateTextEmbedding).not.toHaveBeenCalled();
    expect(mockUpsertTextVector).not.toHaveBeenCalled();

    // The item is marked completed (not failed, not left processing) WITHOUT
    // overwriting its tags — a degraded reprocess must preserve prior enrichment.
    expect(mockItemUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockItemUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.processingStatus).toBe("completed");
    expect(updateArg.data).not.toHaveProperty("tags");
    // Room sync still fires; the task succeeds
    expect(mockTrigger).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, tagCount: 0 });
  });

  it("generates tags and a text embedding when OpenAI is configured", async () => {
    mockIsOpenAiConfigured.mockReturnValue(true);
    mockGenerateTags.mockResolvedValue(["design", "typography"]);
    mockGenerateTextEmbedding.mockResolvedValue({
      embedding: [0.1, 0.2],
      totalTokens: 5,
    });
    mockUpsertTextVector.mockResolvedValue("vec-1");

    const result = await run({ ...ITEM, sourceText: "some article text" });

    expect(mockGenerateTags).toHaveBeenCalledWith("some article text");
    expect(mockGenerateTextEmbedding).toHaveBeenCalled();
    expect(mockUpsertTextVector).toHaveBeenCalled();
    expect(mockRecordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai" }),
    );
    expect(result).toMatchObject({ success: true, tagCount: 2 });
  });
});
