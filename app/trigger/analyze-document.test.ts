import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the side-effecting edges (db, storage, OCR, vision, Trigger SDK) and keep
// the task's control flow real
const m = vi.hoisted(() => ({
  findPages: vi.fn(),
  updatePage: vi.fn(),
  findItem: vi.fn(),
  updateItem: vi.fn(),
  upsertImageDetails: vi.fn(),
  transaction: vi.fn(),
  download: vi.fn(),
  signedUrl: vi.fn(),
  extractPageText: vi.fn(),
  analyzeImageBytes: vi.fn(),
  upsertVisualVector: vi.fn(),
  trigger: vi.fn(),
  markProcessingActive: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  task: (config: unknown) => config,
  tasks: { trigger: m.trigger },
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ download: m.download, createSignedUrl: m.signedUrl }),
    },
  }),
}));
vi.mock("../src/lib/db", () => ({
  default: {
    itemDocumentPage: { findMany: m.findPages, update: m.updatePage },
    item: { findFirstOrThrow: m.findItem, update: m.updateItem },
    itemImageDetails: { upsert: m.upsertImageDetails },
    $transaction: m.transaction,
  },
}));
vi.mock("../src/lib/documents/document-ocr", () => ({
  extractPageText: m.extractPageText,
}));
vi.mock("../src/lib/image-analysis/analyze-image-bytes", () => ({
  analyzeImageBytes: m.analyzeImageBytes,
}));
vi.mock("../src/lib/embeddings", () => ({
  upsertVisualVector: m.upsertVisualVector,
  VISUAL_EMBEDDING_MODEL: "clip",
}));
vi.mock("../src/lib/items/mark-processing-active", () => ({
  markProcessingActive: m.markProcessingActive,
}));
vi.mock("../src/lib/posthog-server", () => ({
  captureServerException: m.capture,
}));
vi.mock("./queues", () => ({ imageAnalysisQueue: {} }));
vi.mock("./analyze-image", () => ({
  getSupabaseConfig: () => ({ url: "http://storage.test", key: "key" }),
  getMimeTypeFromFileKey: () => "image/jpeg",
  formatStorageError: String,
}));

import { analyzeDocumentTask } from "./analyze-document";

type TaskWithRun = { run: (payload: object) => Promise<unknown> };
const run = () =>
  (analyzeDocumentTask as unknown as TaskWithRun).run({
    itemId: "item-1",
    userId: "user-1",
  });

const page = (position: number, ocrText: string | null = null) => ({
  id: `page-${position}`,
  position,
  fileKey: `user-1/p${position}.jpg`,
  originalFileKey: `user-1/p${position}-original.jpg`,
  ocrText,
});

const coverAnalysis = {
  title: "Council tax bill",
  description: "A council tax bill for 2026.",
  tags: ["paper"],
  objects: ["letter"],
  ocrText: "photo-sized excerpt",
  colors: [],
  colorsAnalyzed: true,
  visionData: {},
  blurDataUrl: "data:blur",
  embedding: [0.1, 0.2],
  embeddingModel: "clip",
  openaiConfigured: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.download.mockResolvedValue({
    data: { arrayBuffer: async () => new ArrayBuffer(4) },
    error: null,
  });
  m.findPages.mockResolvedValue([page(0), page(1)]);
  m.extractPageText.mockImplementation(async () => ({
    text: `text ${m.extractPageText.mock.calls.length}`,
    engine: "google_vision",
  }));
  m.analyzeImageBytes.mockResolvedValue(coverAnalysis);
  m.findItem.mockResolvedValue({ kind: "document", titleEditedByUser: false });
  m.updateItem.mockReturnValue("update-item");
  m.upsertImageDetails.mockReturnValue("upsert-details");
  m.transaction.mockResolvedValue([]);
  m.trigger.mockResolvedValue({});
});

describe("analyzeDocumentTask", () => {
  it("OCRs every page from its colour original and stores the text", async () => {
    await run();
    expect(m.download).toHaveBeenCalledWith("user-1/p0-original.jpg");
    expect(m.download).toHaveBeenCalledWith("user-1/p1-original.jpg");
    expect(m.updatePage).toHaveBeenCalledWith({
      where: { id: "page-0" },
      data: { ocrText: "text 1" },
    });
    expect(m.updatePage).toHaveBeenCalledWith({
      where: { id: "page-1" },
      data: { ocrText: "text 2" },
    });
  });

  it("skips pages already OCR'd, so a retry only pays for the rest", async () => {
    m.findPages.mockResolvedValue([page(0, "done already"), page(1)]);
    await run();
    expect(m.extractPageText).toHaveBeenCalledTimes(1);
    expect(m.download).not.toHaveBeenCalledWith("user-1/p0-original.jpg");
  });

  it("analyses only the cover visually", async () => {
    await run();
    expect(m.analyzeImageBytes).toHaveBeenCalledTimes(1);
    expect(m.download).toHaveBeenCalledWith("user-1/p0.jpg");
    expect(m.download).not.toHaveBeenCalledWith("user-1/p1.jpg");
    expect(m.upsertVisualVector).toHaveBeenCalledTimes(1);
  });

  it("stores every page's text as the item's OCR text, not the cover excerpt", async () => {
    await run();
    const [{ create, update }] = m.upsertImageDetails.mock.calls[0];
    expect(create.ocrText).toBe("text 1\n\ntext 2");
    expect(update.ocrText).toBe("text 1\n\ntext 2");
  });

  it("titles the document from its cover unless the user renamed it", async () => {
    await run();
    expect(m.updateItem).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-1" },
      data: {
        title: "Council tax bill",
        description: "A council tax bill for 2026.",
      },
    });

    vi.clearAllMocks();
    m.findItem.mockResolvedValue({ kind: "document", titleEditedByUser: true });
    m.findPages.mockResolvedValue([page(0, "a")]);
    m.analyzeImageBytes.mockResolvedValue(coverAnalysis);
    m.download.mockResolvedValue({
      data: { arrayBuffer: async () => new ArrayBuffer(4) },
      error: null,
    });
    await run();
    expect(m.updateItem).not.toHaveBeenCalled();
  });

  it("enriches from the document text, letting tags come from the text", async () => {
    await run();
    const [id, payload] = m.trigger.mock.calls[0];
    expect(id).toBe("enrich-item");
    expect(payload.sourceText).toContain("text 1\n\ntext 2");
    expect(payload.precomputedTags).toBeUndefined();
  });

  it("still completes when no OCR service is configured", async () => {
    m.extractPageText.mockResolvedValue({ text: null, engine: null });
    await run();
    expect(m.updatePage).not.toHaveBeenCalled();
    const [{ create }] = m.upsertImageDetails.mock.calls[0];
    expect(create.ocrText).toBeNull();
    expect(m.trigger).toHaveBeenCalledWith(
      "enrich-item",
      expect.objectContaining({ itemId: "item-1" }),
    );
  });

  it("marks the item failed and rethrows when a page can't be downloaded", async () => {
    m.download.mockResolvedValue({ data: null, error: new Error("gone") });
    await expect(run()).rejects.toThrow(/Failed to download/);
    expect(m.updateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processingStatus: "failed" }),
      }),
    );
  });
});
