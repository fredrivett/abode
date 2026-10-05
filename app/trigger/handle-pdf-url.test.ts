import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  safeFetch: vi.fn(),
  upload: vi.fn(),
  findItem: vi.fn(),
  updateItem: vi.fn(),
  reclaim: vi.fn(),
  deleteReplaced: vi.fn(),
  prune: vi.fn(),
  trigger: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: m.trigger },
  logger: { log: vi.fn(), warn: vi.fn() },
}));
vi.mock("../src/lib/http/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/http/safe-fetch")>()),
  safeFetch: m.safeFetch,
}));
vi.mock("../src/lib/db", () => ({
  default: {
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({ item: { findUniqueOrThrow: m.findItem, update: m.updateItem } }),
  },
}));
vi.mock("../src/lib/item-details", () => ({ pruneStaleItemDetails: m.prune }));
vi.mock("./reclaim-item-storage", () => ({
  reclaimReplacedStorage: m.reclaim,
  deleteReplacedFiles: m.deleteReplaced,
}));
vi.mock("./analyze-image", () => ({ formatStorageError: String }));

import { SafeFetchError } from "../src/lib/http/safe-fetch";
import {
  FetchError,
  ProcessingFailure,
} from "../src/lib/items/processing-error";
import { handlePdfUrl } from "./handle-pdf-url";

const URL_ = "https://arxiv.org/pdf/1706.03762v7.pdf";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n% a tiny pdf\n%%EOF\n");
const supabase = {
  storage: { from: () => ({ upload: m.upload }) },
} as unknown as Parameters<typeof handlePdfUrl>[0]["supabase"];

function response(
  bytes: Uint8Array,
  { status = 200, disposition = null as string | null } = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => (k === "content-disposition" ? disposition : null),
    },
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

const handle = () =>
  handlePdfUrl({ itemId: "item_1", userId: "user_1", url: URL_, supabase });

async function failure(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.safeFetch.mockResolvedValue(response(PDF_BYTES));
  m.upload.mockResolvedValue({ error: null });
  m.findItem.mockResolvedValue({ titleEditedByUser: false });
  m.reclaim.mockResolvedValue(["user_1/old.pdf", "user_1/old-page.jpg"]);
  m.trigger.mockResolvedValue({});
});

describe("handlePdfUrl", () => {
  it("fetches through the SSRF gate, capped at the PDF upload limit", async () => {
    await handle();
    expect(m.safeFetch).toHaveBeenCalledWith(
      URL_,
      expect.objectContaining({ maxBytes: 25 * 1024 * 1024 }),
    );
  });

  it("stores the PDF and makes the item a document holding it", async () => {
    const result = await handle();
    const [key, , options] = m.upload.mock.calls[0];
    expect(key).toMatch(/^user_1\/[0-9a-f-]{36}\.pdf$/);
    expect(options).toEqual({ contentType: "application/pdf", upsert: false });
    expect(m.updateItem).toHaveBeenCalledWith({
      where: { id: "item_1", userId: "user_1" },
      data: {
        kind: "document",
        sourceFileKey: key,
        fileKey: null,
        coverFileKey: null,
        faviconFileKey: null,
        title: "1706.03762v7",
        meta: {
          originalName: "1706.03762v7.pdf",
          size: PDF_BYTES.byteLength,
          type: "application/pdf",
          originalUrl: URL_,
        },
      },
    });
    expect(m.prune).toHaveBeenCalledWith(
      expect.anything(),
      "item_1",
      "document",
    );
    expect(result).toMatchObject({ kind: "document", fileKey: key });
  });

  it("reclaims the previous capture and deletes its files, keeping the new PDF", async () => {
    await handle();
    expect(m.reclaim).toHaveBeenCalledWith(expect.anything(), {
      itemId: "item_1",
      userId: "user_1",
      addedBytes: PDF_BYTES.byteLength,
    });
    expect(m.deleteReplaced).toHaveBeenCalledWith(
      supabase,
      ["user_1/old.pdf", "user_1/old-page.jpg"],
      [m.upload.mock.calls[0][0]],
    );
  });

  it("hands off to import-pdf", async () => {
    await handle();
    expect(m.trigger).toHaveBeenCalledWith(
      "import-pdf",
      { itemId: "item_1", userId: "user_1" },
      { concurrencyKey: "user_1" },
    );
  });

  it("names it from Content-Disposition when the server sends one", async () => {
    m.safeFetch.mockResolvedValue(
      response(PDF_BYTES, { disposition: 'inline; filename="Attention.pdf"' }),
    );
    await handle();
    expect(m.updateItem.mock.calls[0][0].data).toMatchObject({
      title: "Attention",
      meta: { originalName: "Attention.pdf" },
    });
  });

  it("keeps a title the user set", async () => {
    m.findItem.mockResolvedValue({ titleEditedByUser: true });
    await handle();
    expect(m.updateItem.mock.calls[0][0].data.title).toBeUndefined();
  });

  it("fails a PDF over the size cap as too long, storing nothing", async () => {
    m.safeFetch.mockRejectedValue(
      new SafeFetchError("body_too_large", "Content-Length too big"),
    );
    const error = await failure(handle());
    expect(error).toBeInstanceOf(ProcessingFailure);
    expect((error as ProcessingFailure).reason).toBe("document_too_long");
    expect(m.upload).not.toHaveBeenCalled();
  });

  it("fails as unsupported when the link returns something other than a PDF", async () => {
    m.safeFetch.mockResolvedValue(
      response(new TextEncoder().encode("<html>Please sign in</html>")),
    );
    const error = await failure(handle());
    expect((error as ProcessingFailure).reason).toBe("unsupported_content");
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.trigger).not.toHaveBeenCalled();
  });

  it("surfaces an HTTP error status for classification", async () => {
    m.safeFetch.mockResolvedValue(response(PDF_BYTES, { status: 404 }));
    const error = await failure(handle());
    expect(error).toBeInstanceOf(FetchError);
    expect((error as FetchError).status).toBe(404);
  });
});
