// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeBook } from "../src/lib/imports/payload";
import type { NormalizedBook } from "../src/lib/imports/types";

const m = vi.hoisted(() => ({
  importBookChunk: vi.fn(),
  tallyImportChunk: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  task: (config: unknown) => config,
  logger: { log: vi.fn(), error: vi.fn() },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("../src/lib/imports/import-book-chunk", () => m);
vi.mock("../src/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
}));

import { importLiteralBooksTask } from "./import-literal-books";

type Payload = {
  userId: string;
  importId: string;
  books: ReturnType<typeof serializeBook>[];
};
const task = importLiteralBooksTask as unknown as {
  run: (payload: Payload) => Promise<unknown>;
};

const book = (): NormalizedBook => ({
  sourceId: crypto.randomUUID(),
  title: "B",
  subtitle: null,
  description: null,
  authors: [],
  publisher: null,
  publishedAt: null,
  isbn: null,
  pageCount: null,
  language: null,
  coverUrl: null,
  addedAt: null,
  reading: {
    status: "read",
    rating: null,
    review: null,
    finishedAt: null,
    finishedAtPrecision: null,
  },
});

const payload: Payload = {
  userId: "u1",
  importId: "imp1",
  books: [book(), book(), book()].map(serializeBook),
};

describe("import-literal-books", () => {
  beforeEach(() => {
    m.importBookChunk.mockReset();
    m.tallyImportChunk.mockReset().mockResolvedValue(false);
    vi.stubEnv("SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("tallies every book as failed when the chunk fails before writing any", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    await expect(task.run(payload)).rejects.toThrow("Missing Supabase config");

    expect(m.importBookChunk).not.toHaveBeenCalled();
    expect(m.tallyImportChunk).toHaveBeenCalledWith({
      userId: "u1",
      importId: "imp1",
      tally: { imported: 0, skipped: 0, failed: 3 },
    });
  });

  it("rethrows the original error when that failure tally fails too", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    m.tallyImportChunk.mockRejectedValue(new Error("db down"));

    await expect(task.run(payload)).rejects.toThrow("Missing Supabase config");
  });

  it("doesn't retally a chunk whose own tally failed (it may have committed)", async () => {
    m.importBookChunk.mockRejectedValue(new Error("tally lost"));

    await expect(task.run(payload)).rejects.toThrow("tally lost");

    expect(m.importBookChunk).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", importId: "imp1" }),
    );
    expect(m.tallyImportChunk).not.toHaveBeenCalled();
  });
});
