/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { tasks } from "@trigger.dev/sdk";

// analyze-image against the real database: storage, Trigger.dev and the paid
// vision call are the only fakes.

const storage = vi.hoisted(() => new Map<string, Uint8Array>());

vi.mock("@trigger.dev/sdk", () => ({
  task: (config: unknown) => config,
  tasks: { trigger: vi.fn() },
  logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  queue: (config: unknown) => config,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        download: async (key: string) => {
          const bytes = storage.get(key);
          return bytes
            ? { data: new Blob([bytes as BlobPart]), error: null }
            : { data: null, error: new Error(`missing ${key}`) };
        },
      }),
    },
  }),
}));
vi.mock("@/lib/image-analysis/analyze-image-bytes", () => ({
  analyzeImageBytes: vi.fn(async () => ({
    title: "Book cover",
    description: "A book cover",
    tags: ["book", "desert"],
    objects: ["sand dune"],
    ocrText: "DUNE",
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

import { analyzeImageTask } from "./analyze-image";

type Runnable = { run: (payload: object) => Promise<unknown> };
const runTask = (payload: object) =>
  (analyzeImageTask as unknown as Runnable).run(payload);

describe("analyze-image integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    storage.clear();
    process.env.SUPABASE_URL = "https://storage.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "key";
    vi.mocked(tasks.trigger).mockReset();
    vi.mocked(tasks.trigger).mockResolvedValue({} as never);
  });

  async function createItem(
    processingStatus: "processing" | "completed",
  ): Promise<{ itemId: string; userId: string; fileKey: string }> {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `cover-${crypto.randomUUID()}@example.com`,
      },
    });
    const fileKey = `${user.id}/${crypto.randomUUID()}.jpg`;
    const item = await write.item.create({
      data: {
        userId: user.id,
        kind: "book",
        sourceType: "url",
        sourceUrl: "https://books.example.com/dune",
        title: "Dune",
        coverFileKey: fileKey,
        processingStatus,
      },
      select: { id: true },
    });
    return { itemId: item.id, userId: user.id, fileKey };
  }

  test("enriches a book cover once, from the book's text plus the cover", async () => {
    const { itemId, userId, fileKey } = await createItem("processing");
    storage.set(fileKey, new Uint8Array([0xff, 0xd8, 0xff]));

    await runTask({
      itemId,
      userId,
      fileKey,
      extraSourceText: "Dune Frank Herbert A desert planet epic",
    });

    expect(tasks.trigger).toHaveBeenCalledTimes(1);
    const [taskId, payload] = vi.mocked(tasks.trigger).mock.calls[0];
    expect(taskId).toBe("enrich-item");
    expect(payload).toMatchObject({
      itemId,
      precomputedTags: ["book", "desert"],
      sourceText: "Dune Frank Herbert A desert planet epic sand dune DUNE",
    });
  });

  test("a failed cover analysis never turns a completed item failed", async () => {
    // No stored bytes, so the download fails
    const { itemId, userId, fileKey } = await createItem("completed");

    await expect(runTask({ itemId, userId, fileKey })).rejects.toThrow(
      /Failed to download image/,
    );

    const { read } = await import("@/lib/db");
    expect(
      await read.item.findUniqueOrThrow({
        where: { id: itemId },
        select: { processingStatus: true, processingError: true },
      }),
    ).toEqual({ processingStatus: "completed", processingError: null });
  });

  test("a failed analysis of an item still processing marks it failed", async () => {
    const { itemId, userId, fileKey } = await createItem("processing");

    await expect(runTask({ itemId, userId, fileKey })).rejects.toThrow();

    const { read } = await import("@/lib/db");
    expect(
      await read.item.findUniqueOrThrow({
        where: { id: itemId },
        select: { processingStatus: true },
      }),
    ).toEqual({ processingStatus: "failed" });
  });
});
