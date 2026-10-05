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
  describeDocument: vi.fn(),
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
  MAX_OCR_PAGES_PER_DOCUMENT: 30,
}));
vi.mock("../src/lib/documents/describe-document", () => ({
  describeDocument: m.describeDocument,
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

import { analyzeDocumentPages, analyzeDocumentTask } from "./analyze-document";

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
  m.describeDocument.mockResolvedValue({
    title: "Mous order confirmation, Mar 2026",
    description: "An order confirmation from Mous.",
  });
  m.findItem.mockResolvedValue({
    kind: "document",
    titleEditedByUser: false,
    meta: { pageCount: 2 },
  });
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

  it("analyses only the cover visually, without its discarded OCR", async () => {
    await run();
    expect(m.analyzeImageBytes).toHaveBeenCalledTimes(1);
    expect(m.analyzeImageBytes).toHaveBeenCalledWith(
      expect.objectContaining({ ocr: false }),
    );
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

  it("titles the document from its text", async () => {
    await run();
    expect(m.describeDocument).toHaveBeenCalledWith({
      text: "text 1\n\ntext 2",
      userId: "user-1",
      itemId: "item-1",
    });
    expect(m.updateItem).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-1" },
      data: {
        title: "Mous order confirmation, Mar 2026",
        description: "An order confirmation from Mous.",
      },
    });
  });

  it("leaves a title the user renamed, without paying to describe it", async () => {
    m.findItem.mockResolvedValue({
      kind: "document",
      titleEditedByUser: true,
      meta: { pageCount: 2 },
    });
    await run();
    expect(m.describeDocument).not.toHaveBeenCalled();
    expect(m.updateItem).not.toHaveBeenCalled();
  });

  it("falls back to the cover's title when the document has no text", async () => {
    m.extractPageText.mockResolvedValue({ text: null, engine: null });
    await run();
    expect(m.describeDocument).not.toHaveBeenCalled();
    expect(m.updateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: "Council tax bill",
          description: "A council tax bill for 2026.",
        },
      }),
    );
  });

  it("falls back to the cover's title when describing fails, and still completes", async () => {
    m.describeDocument.mockRejectedValue(new Error("openai down"));
    await expect(run()).resolves.toMatchObject({ success: true });
    expect(m.capture).toHaveBeenCalledWith(
      expect.any(Error),
      "user-1",
      expect.objectContaining({ source: "analyze-document:describe" }),
    );
    expect(m.updateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Council tax bill" }),
      }),
    );
  });

  it("leaves the title alone when OpenAI isn't configured", async () => {
    m.describeDocument.mockResolvedValue(null);
    m.analyzeImageBytes.mockResolvedValue({
      ...coverAnalysis,
      title: "",
      description: "",
      openaiConfigured: false,
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

  it("fails a document that has no pages", async () => {
    m.findPages.mockResolvedValue([]);
    await expect(run()).rejects.toThrow("Document has no pages");
    expect(m.updateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processingStatus: "failed" }),
      }),
    );
    expect(m.trigger).not.toHaveBeenCalled();
  });

  it("still completes when the visual vector can't be stored", async () => {
    m.upsertVisualVector.mockRejectedValue(new Error("pgvector down"));
    await expect(run()).resolves.toMatchObject({ success: true });
    expect(m.capture).toHaveBeenCalledWith(
      expect.any(Error),
      "user-1",
      expect.objectContaining({ source: "analyze-document:visual-embedding" }),
    );
    expect(m.trigger).toHaveBeenCalledWith("enrich-item", expect.anything());
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

describe("analyzeDocumentPages (shared with PDF import)", () => {
  const analyze = (maxOcrPages?: number) =>
    analyzeDocumentPages({ itemId: "item-1", userId: "user-1", maxOcrPages });

  it("uses a PDF page's text layer and only OCRs the scanned pages", async () => {
    m.findPages.mockResolvedValue([
      page(0, "Typed invoice text from the PDF's text layer"),
      page(1),
      page(2, "Typed terms and conditions"),
    ]);
    const result = await analyze();

    expect(m.extractPageText).toHaveBeenCalledTimes(1);
    expect(m.download).toHaveBeenCalledWith("user-1/p1-original.jpg");
    expect(m.download).not.toHaveBeenCalledWith("user-1/p0-original.jpg");
    expect(m.download).not.toHaveBeenCalledWith("user-1/p2-original.jpg");
    const [{ create }] = m.upsertImageDetails.mock.calls[0];
    expect(create.ocrText).toBe(
      "Typed invoice text from the PDF's text layer\n\ntext 1\n\nTyped terms and conditions",
    );
    expect(result).toEqual({ pages: 3, pagesWithText: 3, ocrSkippedPages: 0 });
  });

  it("makes no OCR calls for a PDF that's all text", async () => {
    m.findPages.mockResolvedValue([page(0, "one"), page(1, "two")]);
    await analyze();
    expect(m.extractPageText).not.toHaveBeenCalled();
  });

  it("stops OCR at the cap and records the skipped pages on meta", async () => {
    m.findPages.mockResolvedValue([page(0), page(1), page(2), page(3)]);
    const result = await analyze(2);

    expect(m.extractPageText).toHaveBeenCalledTimes(2);
    expect(m.download).not.toHaveBeenCalledWith("user-1/p2-original.jpg");
    expect(result.ocrSkippedPages).toBe(2);
    expect(m.updateItem).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-1" },
      data: expect.objectContaining({
        meta: { pageCount: 2, ocrSkippedPages: 2 },
      }),
    });
  });

  it("OCRs nothing when the cap is 0 (daily allowance used up)", async () => {
    const result = await analyze(0);
    expect(m.extractPageText).not.toHaveBeenCalled();
    expect(result.ocrSkippedPages).toBe(2);
  });

  it("clears a stale skipped count once every page has text", async () => {
    m.findItem.mockResolvedValue({
      kind: "document",
      titleEditedByUser: true,
      meta: { pageCount: 2, ocrSkippedPages: 1 },
    });
    await analyze();
    expect(m.updateItem).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-1" },
      data: { meta: { pageCount: 2 } },
    });
  });

  it("merges the skipped count into the item's current meta, not a stale read", async () => {
    m.findPages.mockResolvedValue([page(0), page(1), page(2)]);
    m.findItem
      .mockResolvedValueOnce({
        kind: "document",
        titleEditedByUser: true,
        meta: { pageCount: 2 },
      })
      // Meanwhile the import recorded its OCR charge
      .mockResolvedValueOnce({ meta: { pageCount: 3, ocrPagesCharged: 1 } });
    await analyze(1);
    expect(m.updateItem).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-1" },
      data: { meta: { pageCount: 3, ocrPagesCharged: 1, ocrSkippedPages: 2 } },
    });
  });
});
