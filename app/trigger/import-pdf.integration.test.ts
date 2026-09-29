/// <reference types="vitest/globals" />

import { buildPdf } from "@app/test/pdf-fixtures";
import { resetTestDatabase } from "@app/vitest.setup.db";
import { tasks } from "@trigger.dev/sdk";

// A PDF upload end to end against the real database: the route creates the
// document, the import renders its pages (real mupdf), the analysis stores its
// text, search finds it, and delete removes every file. Storage, Trigger.dev
// and the paid AI calls are the only fakes.

const storage = vi.hoisted(() => new Map<string, Uint8Array>());
const auth = vi.hoisted(() => ({ userId: "" }));

vi.mock("@trigger.dev/sdk", () => ({
  task: (config: unknown) => config,
  tasks: { trigger: vi.fn() },
  AbortTaskRunError: class AbortTaskRunError extends Error {},
  logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  queue: (config: unknown) => config,
}));

const fakeStorage = vi.hoisted(() => ({
  from: () => ({
    upload: async (key: string, bytes: Uint8Array) => {
      storage.set(key, bytes);
      return { error: null };
    },
    download: async (key: string) => {
      const bytes = storage.get(key);
      return bytes
        ? { data: new Blob([bytes as BlobPart]), error: null }
        : { data: null, error: new Error(`missing ${key}`) };
    },
    remove: async (keys: string[]) => {
      for (const key of keys) storage.delete(key);
      return { error: null };
    },
    createSignedUrl: async (key: string) => ({
      data: { signedUrl: `https://storage.test/${key}` },
      error: null,
    }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: fakeStorage }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ storage: fakeStorage }),
  getUserWithMfa: async () => ({
    data: { user: { id: auth.userId } },
    error: null,
  }),
}));
vi.mock("./analyze-image", () => ({
  getSupabaseConfig: () => ({ url: "https://storage.test", key: "key" }),
  getMimeTypeFromFileKey: () => "image/jpeg",
  formatStorageError: String,
}));

// Paid services: OCR reads the scanned page, vision describes the cover
vi.mock("@/lib/documents/document-ocr", () => ({
  MAX_OCR_PAGES_PER_DOCUMENT: 30,
  isDocumentOcrConfigured: () => true,
  extractPageText: vi.fn(async () => ({
    text: "Handwritten note: meter reading taken by the Wexford engineer",
    engine: "google_vision",
  })),
}));
vi.mock("@/lib/documents/describe-document", () => ({
  describeDocument: vi.fn(async () => ({
    title: "Northside Energy bill, Q1 2026",
    description: "A quarterly energy bill from Northside Energy.",
  })),
}));
vi.mock("@/lib/image-analysis/analyze-image-bytes", () => ({
  analyzeImageBytes: vi.fn(async () => ({
    title: "Printed letter",
    description: "A printed letter",
    tags: [],
    objects: ["paper"],
    ocrText: null,
    colors: [],
    colorsAnalyzed: true,
    visionData: {},
    blurDataUrl: "data:image/jpeg;base64,AAAA",
    embedding: null,
    embeddingModel: null,
    openaiConfigured: true,
  })),
}));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: () => null,
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));

import { POST } from "@/app/api/v1/items/documents/pdf/route";
import { collectItemFileKeys, itemFileKeysSelect } from "@/lib/item-storage";
import { deleteOwnedItem } from "@/lib/items/delete-item";
import { findItemOwningImageKey } from "@/lib/items/image-key-lookup";
import { ocrTextSearch } from "@/lib/search/full-text-search";
import { analyzeDocumentTask } from "./analyze-document";
import { importPdfTask } from "./import-pdf";

type Runnable = { run: (payload: object) => Promise<unknown> };
const runTask = (task: unknown, payload: object) =>
  (task as Runnable).run(payload);

describe("PDF upload integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    storage.clear();
    vi.mocked(tasks.trigger).mockReset();
    vi.mocked(tasks.trigger).mockResolvedValue({} as never);
  });

  async function createUser() {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `pdf-${crypto.randomUUID()}@example.com`,
      },
    });
    auth.userId = user.id;
    return user;
  }

  /** Upload a PDF the way the client does, then save it through the route */
  async function uploadPdf(userId: string, bytes: Uint8Array) {
    const fileKey = `${userId}/${crypto.randomUUID()}.pdf`;
    storage.set(fileKey, bytes);
    const request = {
      json: async () => ({
        fileKey,
        originalName: "Q1-bill.pdf",
        size: bytes.byteLength,
      }),
    } as unknown as Parameters<typeof POST>[0];
    const res = await POST(request);
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    return { itemId: id, fileKey };
  }

  /** Run what the enqueues would have run: import, then analysis */
  async function runImport(itemId: string, userId: string) {
    await runTask(importPdfTask, { itemId, userId });
    const analysis = vi
      .mocked(tasks.trigger)
      .mock.calls.find(([id]) => id === "analyze-document");
    expect(analysis).toBeDefined();
    await runTask(analyzeDocumentTask, analysis?.[1] as object);
  }

  test("imports a mixed text + scanned PDF into a searchable document", async () => {
    const user = await createUser();
    const pdfBytes = await buildPdf([
      { text: "Northside Energy quarterly bill for the Hollybrook flat" },
      { scan: true },
    ]);
    const { itemId, fileKey } = await uploadPdf(user.id, pdfBytes);

    // Saved straight away as a processing document holding the PDF
    const { read } = await import("@/lib/db");
    expect(
      await read.item.findUniqueOrThrow({
        where: { id: itemId },
        select: { kind: true, processingStatus: true, sourceFileKey: true },
      }),
    ).toEqual({
      kind: "document",
      processingStatus: "processing",
      sourceFileKey: fileKey,
    });
    expect(tasks.trigger).toHaveBeenCalledWith(
      "import-pdf",
      { itemId, userId: user.id },
      expect.anything(),
    );

    await runImport(itemId, user.id);

    const pages = await read.itemDocumentPage.findMany({
      where: { itemId },
      orderBy: { position: "asc" },
    });
    expect(pages).toHaveLength(2);
    // Page 1 from its text layer, page 2 (a scan) from OCR
    expect(pages[0].ocrText).toContain("Hollybrook");
    expect(pages[1].ocrText).toContain("Wexford");

    const item = await read.item.findUniqueOrThrow({
      where: { id: itemId },
      select: {
        title: true,
        fileKey: true,
        meta: true,
        imageDetails: { select: { ocrText: true } },
      },
    });
    expect(item.title).toBe("Northside Energy bill, Q1 2026");
    expect(item.fileKey).toBe(pages[0].fileKey);
    expect(item.meta).toMatchObject({ pageCount: 2, type: "image/jpeg" });
    expect(item.imageDetails?.ocrText).toContain("Hollybrook");
    expect(item.imageDetails?.ocrText).toContain("Wexford");

    // Both the text layer and the OCR'd scan feed search
    for (const word of ["Hollybrook", "Wexford"]) {
      const results = await ocrTextSearch(user.id, {}, word);
      expect(results.map((r) => r.id)).toEqual([itemId]);
    }

    // Storage accounting covers the PDF and every page image
    const stored = [...storage.values()].reduce((t, b) => t + b.byteLength, 0);
    const { storageUsedBytes } = await read.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { storageUsedBytes: true },
    });
    expect(Number(storageUsedBytes)).toBe(stored);
  });

  test("the file-key inventory holds the PDF and every page, and delete removes them all", async () => {
    const user = await createUser();
    const { itemId, fileKey } = await uploadPdf(
      user.id,
      await buildPdf([
        { text: "A two page contract between the parties" },
        { scan: true },
      ]),
    );
    await runImport(itemId, user.id);

    const { read } = await import("@/lib/db");
    const row = await read.item.findUniqueOrThrow({
      where: { id: itemId },
      select: itemFileKeysSelect,
    });
    const keys = collectItemFileKeys(row);
    // Exactly what's in storage: the PDF plus one image per page
    expect(new Set(keys)).toEqual(new Set(storage.keys()));
    expect(keys).toContain(fileKey);
    expect(keys).toHaveLength(3);
    // The image proxy (and download) can resolve each one to this item
    for (const key of keys) {
      expect((await findItemOwningImageKey(key))?.id).toBe(itemId);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const result = await deleteOwnedItem({
      supabase: await createClient(),
      itemId,
      userId: user.id,
    });
    expect(result).toBe("deleted");
    expect(storage.size).toBe(0);
    expect(
      await read.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { itemCount: true, storageUsedBytes: true },
      }),
    ).toEqual({ itemCount: 0, storageUsedBytes: BigInt(0) });
  });

  test("marks a password-protected PDF failed as unreadable, storing no pages", async () => {
    const user = await createUser();
    const { itemId } = await uploadPdf(
      user.id,
      await buildPdf(
        [{ text: "Confidential salary letter for the employee" }],
        {
          password: "secret",
        },
      ),
    );

    await expect(
      runTask(importPdfTask, { itemId, userId: user.id }),
    ).rejects.toThrow();

    const { read } = await import("@/lib/db");
    expect(
      await read.item.findUniqueOrThrow({
        where: { id: itemId },
        select: { processingStatus: true, processingError: true },
      }),
    ).toEqual({
      processingStatus: "failed",
      processingError: "file_unreadable",
    });
    expect(await read.itemDocumentPage.count({ where: { itemId } })).toBe(0);
    // Only the PDF itself is stored, so deleting the item cleans up fully
    expect(storage.size).toBe(1);
  });
});
