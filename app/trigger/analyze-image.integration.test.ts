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

type Hooks = {
  run: (payload: object) => Promise<unknown>;
  onFailure: (params: { payload: object; error: unknown }) => Promise<void>;
};
const hooks = analyzeImageTask as unknown as Hooks;
const runTask = (payload: object) => hooks.run(payload);
// What Trigger calls once no retry is left
const failRun = (payload: object, error: unknown) =>
  hooks.onFailure({ payload, error });

async function statusOf(itemId: string) {
  const { read } = await import("@/lib/db");
  return read.item.findUniqueOrThrow({
    where: { id: itemId },
    select: { processingStatus: true, processingError: true },
  });
}

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
    // Tags come from the blend, not the cover's vision tags alone; the cover's
    // text leads so a long description is what the token limit cuts
    expect(payload).toEqual({
      itemId,
      userId,
      sourceText: "sand dune DUNE Dune Frank Herbert A desert planet epic",
    });
  });

  test("keeps the vision tags for a plain image", async () => {
    const { itemId, userId, fileKey } = await createItem("processing");
    storage.set(fileKey, new Uint8Array([0xff, 0xd8, 0xff]));

    await runTask({ itemId, userId, fileKey });

    const [, payload] = vi.mocked(tasks.trigger).mock.calls[0];
    expect(payload).toMatchObject({ precomputedTags: ["book", "desert"] });
  });

  test("enriches a book from its text once its cover analysis has failed for good", async () => {
    const { itemId, userId, fileKey } = await createItem("processing");

    await hooks.onFailure({
      payload: {
        itemId,
        userId,
        fileKey,
        extraSourceText: "Dune Frank Herbert",
      },
      error: new Error("Failed to download image"),
    });

    expect(tasks.trigger).toHaveBeenCalledWith("enrich-item", {
      itemId,
      userId,
      sourceText: "Dune Frank Herbert",
    });
  });

  test("a failed attempt leaves the item processing for Trigger's retry", async () => {
    // No stored bytes, so the download fails
    const { itemId, userId, fileKey } = await createItem("processing");

    await expect(runTask({ itemId, userId, fileKey })).rejects.toThrow(
      /Failed to download image/,
    );

    // Still processing: the grid keeps polling and Retry stays closed
    expect(await statusOf(itemId)).toEqual({
      processingStatus: "processing",
      processingError: null,
    });
  });

  test("the final failure marks an item still processing failed", async () => {
    const { itemId, userId } = await createItem("processing");

    await failRun({ itemId, userId }, new Error("Failed to download image"));

    expect(await statusOf(itemId)).toEqual({
      processingStatus: "failed",
      processingError: "unknown",
    });
  });

  test("the final failure never turns a completed item failed", async () => {
    const { itemId, userId } = await createItem("completed");

    await failRun({ itemId, userId }, new Error("Failed to download image"));

    expect(await statusOf(itemId)).toEqual({
      processingStatus: "completed",
      processingError: null,
    });
  });
});
