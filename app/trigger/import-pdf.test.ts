// @vitest-environment node
import { buildPdf } from "@app/test/pdf-fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Real PDF rendering (mupdf) on generated PDFs; the side-effecting edges (db,
// storage, usage limits, Trigger SDK) are mocked
// A small in-memory stand-in for the item and its pages, so the mocks answer
// from saved state rather than from how the task happens to query
type FakePage = { ocrText: string | null };
const db = vi.hoisted(() => ({
  sourceFileKey: "" as string | null,
  meta: {} as Record<string, unknown>,
  pages: [] as FakePage[],
}));
const m = vi.hoisted(() => ({
  findItem: vi.fn(),
  countPages: vi.fn(),
  createPages: vi.fn(),
  updateItem: vi.fn(),
  updateUser: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  guard: vi.fn(),
  ocrConfigured: vi.fn(),
  enqueue: vi.fn(),
  markFailed: vi.fn(),
  markActive: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  task: (config: unknown) => config,
  AbortTaskRunError: class AbortTaskRunError extends Error {},
  logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        download: m.download,
        upload: m.upload,
        remove: m.remove,
      }),
    },
  }),
}));
vi.mock("../src/lib/db", () => {
  const item = {
    findFirstOrThrow: m.findItem,
    findUnique: async () => ({
      sourceFileKey: db.sourceFileKey,
      meta: db.meta,
    }),
    findUniqueOrThrow: async () => ({ meta: db.meta }),
    update: m.updateItem,
  };
  const itemDocumentPage = { count: m.countPages, createMany: m.createPages };
  const tx = { item, itemDocumentPage, user: { update: m.updateUser } };
  return {
    default: {
      item,
      itemDocumentPage,
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});
vi.mock("../src/lib/usage-limits", () => ({ guardDailyLimit: m.guard }));
vi.mock("../src/lib/documents/document-ocr", () => ({
  isDocumentOcrConfigured: m.ocrConfigured,
  MAX_OCR_PAGES_PER_DOCUMENT: 30,
}));
vi.mock("../src/lib/items/enqueue-user-processing", () => ({
  enqueueUserProcessing: m.enqueue,
}));
vi.mock("../src/lib/items/mark-processing-active", () => ({
  markProcessingActive: m.markActive,
}));
vi.mock("./analyze-document", () => ({ markDocumentFailed: m.markFailed }));
vi.mock("./analyze-image", () => ({
  getSupabaseConfig: () => ({ url: "http://storage.test", key: "key" }),
  formatStorageError: String,
}));
vi.mock("./queues", () => ({ documentImportQueue: {} }));
vi.mock("../src/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: m.capture }),
}));

import { ProcessingFailure } from "../src/lib/items/processing-error";
import { importPdfTask } from "./import-pdf";

type TaskWithRun = { run: (payload: object) => Promise<unknown> };
const run = () =>
  (importPdfTask as unknown as TaskWithRun).run({
    itemId: "item-1",
    userId: "user-1",
  });

const TEXT = "Northside Energy quarterly bill, total due 84.20 GBP";

async function storePdf(bytes: Uint8Array) {
  m.download.mockResolvedValue({
    data: new Blob([bytes as BlobPart]),
    error: null,
  });
}

const savedPages = (count: number, scanned: number): FakePage[] =>
  Array.from({ length: count }, (_, i) => ({
    ocrText: i < scanned ? null : TEXT,
  }));

beforeEach(async () => {
  vi.clearAllMocks();
  db.sourceFileKey = "user-1/bill.pdf";
  db.meta = { originalName: "bill.pdf", size: 5000, type: "application/pdf" };
  db.pages = [];
  m.findItem.mockImplementation(async () => ({
    sourceFileKey: db.sourceFileKey,
    _count: { documentPages: db.pages.length },
  }));
  m.createPages.mockImplementation(async ({ data }) => {
    db.pages.push(...data);
  });
  m.updateItem.mockImplementation(async ({ data }) => {
    if (data.meta) db.meta = data.meta;
  });
  m.countPages.mockImplementation(
    async ({ where }: { where: { ocrText?: null } }) =>
      db.pages.filter((page) => !("ocrText" in where) || page.ocrText === null)
        .length,
  );
  m.upload.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
  m.guard.mockResolvedValue({ ok: true });
  m.ocrConfigured.mockReturnValue(true);
  m.enqueue.mockResolvedValue({});
  await storePdf(
    await buildPdf([{ text: TEXT }, { scan: true }, { text: TEXT }]),
  );
});

describe("importPdfTask", () => {
  it("renders every page to a JPEG in the user's folder", async () => {
    await run();
    expect(m.upload).toHaveBeenCalledTimes(3);
    for (const [key, bytes, options] of m.upload.mock.calls) {
      expect(key).toMatch(/^user-1\/[0-9a-f-]{36}\.jpg$/);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(options).toEqual({ contentType: "image/jpeg", upsert: false });
    }
  });

  it("keeps text-layer pages' text and leaves scanned pages for OCR", async () => {
    await run();
    const [{ data }] = m.createPages.mock.calls[0];
    expect(
      data.map((page: { ocrText: string | null }) => page.ocrText),
    ).toEqual([TEXT, null, TEXT]);
    expect(data[0]).toMatchObject({
      itemId: "item-1",
      position: 0,
      filter: "original",
      width: 1414,
      height: 2000,
    });
    // One image per page serves as both the displayed page and its original
    expect(data[0].originalFileKey).toBe(data[0].fileKey);
    expect(data.map((p: { fileKey: string }) => p.fileKey)).toEqual(
      m.upload.mock.calls.map(([key]) => key),
    );
  });

  it("makes page 1 the cover and accounts the page images' storage", async () => {
    await run();
    const pageBytes = m.upload.mock.calls.reduce(
      (total, [, bytes]) => total + bytes.byteLength,
      0,
    );
    expect(m.updateItem).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-1" },
      data: {
        fileKey: m.upload.mock.calls[0][0],
        meta: {
          originalName: "bill.pdf",
          type: "image/jpeg",
          width: 1414,
          height: 2000,
          size: 5000 + pageBytes,
          pageCount: 3,
        },
      },
    });
    expect(m.updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { storageUsedBytes: { increment: pageBytes } },
    });
  });

  it("charges only the scanned pages to the allowance and hands off to analysis", async () => {
    await run();
    expect(m.guard).toHaveBeenCalledWith("user-1", "ingestion", { weight: 1 });
    expect(m.enqueue).toHaveBeenCalledWith(
      "analyze-document",
      { itemId: "item-1", userId: "user-1", maxOcrPages: 1 },
      "user-1",
    );
  });

  it("charges nothing for a PDF that's all text", async () => {
    await storePdf(await buildPdf([{ text: TEXT }, { text: TEXT }]));
    await run();
    expect(m.guard).not.toHaveBeenCalled();
    expect(m.enqueue).toHaveBeenCalledWith(
      "analyze-document",
      expect.objectContaining({ maxOcrPages: 0 }),
      "user-1",
    );
  });

  it("caps OCR at 30 pages however many are scanned", async () => {
    // Pages already saved (a retry), so the cap is tested without rendering 35
    db.pages = savedPages(35, 35);
    await run();
    expect(m.guard).toHaveBeenCalledWith("user-1", "ingestion", { weight: 30 });
    expect(m.enqueue).toHaveBeenCalledWith(
      "analyze-document",
      expect.objectContaining({ maxOcrPages: 30 }),
      "user-1",
    );
  });

  it("imports without OCR when the daily allowance is spent", async () => {
    m.guard.mockResolvedValue({ ok: false, check: { retryAfterSeconds: 60 } });
    await expect(run()).resolves.toMatchObject({ success: true });
    expect(m.enqueue).toHaveBeenCalledWith(
      "analyze-document",
      expect.objectContaining({ maxOcrPages: 0 }),
      "user-1",
    );
  });

  it("doesn't charge the allowance when no OCR service is configured", async () => {
    m.ocrConfigured.mockReturnValue(false);
    await run();
    expect(m.guard).not.toHaveBeenCalled();
  });

  it("skips rendering on a retry once pages exist", async () => {
    db.pages = savedPages(3, 1);
    await run();
    expect(m.download).not.toHaveBeenCalled();
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.createPages).not.toHaveBeenCalled();
    expect(m.enqueue).toHaveBeenCalledWith(
      "analyze-document",
      expect.objectContaining({ maxOcrPages: 1 }),
      "user-1",
    );
  });

  it("fails a damaged PDF as unreadable without retrying or storing anything", async () => {
    await storePdf(new TextEncoder().encode("%PDF-1.7 truncated nonsense"));
    const error = await run().catch((e: unknown) => e);
    expect((error as Error).constructor.name).toBe("AbortTaskRunError");
    const [{ error: cause }] = m.markFailed.mock.calls[0];
    expect(cause).toBeInstanceOf(ProcessingFailure);
    expect(cause.reason).toBe("file_unreadable");
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("fails a file past the size cap as too long, without opening it", async () => {
    m.download.mockResolvedValue({
      data: { size: 26 * 1024 * 1024, arrayBuffer: vi.fn() },
      error: null,
    });
    const error = await run().catch((e: unknown) => e);
    expect((error as Error).constructor.name).toBe("AbortTaskRunError");
    expect(m.markFailed.mock.calls[0][0].error.reason).toBe(
      "document_too_long",
    );
  });

  it("removes the pages it uploaded when an upload fails, and lets Trigger retry", async () => {
    m.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("storage down") });
    await expect(run()).rejects.toThrow(/Failed to upload page 2/);
    expect(m.remove).toHaveBeenCalledWith(
      m.upload.mock.calls.map(([key]) => key),
    );
    expect(m.createPages).not.toHaveBeenCalled();
    expect(m.markFailed).toHaveBeenCalledTimes(1);
  });

  it("drops its pages if a concurrent attempt saved first", async () => {
    // Saved between the task's first read and its own save
    m.findItem.mockResolvedValueOnce({
      sourceFileKey: db.sourceFileKey,
      _count: { documentPages: 0 },
    });
    db.pages = savedPages(3, 1);
    await run();
    expect(m.createPages).not.toHaveBeenCalled();
    expect(m.remove).toHaveBeenCalledWith(
      m.upload.mock.calls.map(([key]) => key),
    );
    expect(m.enqueue).toHaveBeenCalled();
  });

  it("drops its pages without failing if the URL was re-captured mid-import", async () => {
    m.findItem.mockResolvedValueOnce({
      sourceFileKey: db.sourceFileKey,
      _count: { documentPages: 0 },
    });
    // The re-capture swapped in a new PDF while this one rendered
    db.sourceFileKey = "user-1/recaptured.pdf";
    await expect(run()).resolves.toMatchObject({ superseded: true });
    expect(m.createPages).not.toHaveBeenCalled();
    expect(m.remove).toHaveBeenCalledWith(
      m.upload.mock.calls.map(([key]) => key),
    );
    expect(m.enqueue).not.toHaveBeenCalled();
    expect(m.markFailed).not.toHaveBeenCalled();
  });

  it("records the OCR charge so a retry doesn't pay for the same pages again", async () => {
    await run();
    expect(db.meta.ocrPagesCharged).toBe(1);

    m.guard.mockClear();
    await run();
    expect(m.guard).not.toHaveBeenCalled();
    expect(m.enqueue).toHaveBeenLastCalledWith(
      "analyze-document",
      expect.objectContaining({ maxOcrPages: 1 }),
      "user-1",
    );
  });

  it("doesn't record a charge when the allowance was spent, so a later retry can try again", async () => {
    m.guard.mockResolvedValue({ ok: false, check: { retryAfterSeconds: 60 } });
    await run();
    expect(db.meta.ocrPagesCharged).toBeUndefined();
  });

  it("reports the import to PostHog with its page breakdown", async () => {
    await run();
    expect(m.capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "pdf_imported",
      properties: {
        item_id: "item-1",
        pages: 3,
        scanned_pages: 1,
        ocr_pages: 1,
        retried: false,
      },
    });
  });

  it("reports a failed import with its reason", async () => {
    await storePdf(new TextEncoder().encode("not a pdf"));
    await run().catch(() => undefined);
    expect(m.capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "pdf_import_failed",
      properties: { item_id: "item-1", reason: "file_unreadable" },
    });
  });
});
