/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { ItemKind, Prisma, ProcessingStatus } from "@prisma/client";

const batchTrigger = vi.hoisted(() => vi.fn());
const trigger = vi.hoisted(() => vi.fn());
vi.mock("@trigger.dev/sdk", () => ({ tasks: { batchTrigger, trigger } }));

import { reprocessIssueGroup } from "@/lib/admin/reprocess-issues";

describe("reprocessIssueGroup", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    batchTrigger.mockReset().mockResolvedValue({ batchId: "b" });
    trigger.mockReset().mockResolvedValue({ id: "r" });
  });

  const seed = async (opts: {
    kind?: ItemKind;
    status: ProcessingStatus;
    sourceType?: "url" | "upload" | "compose";
    sourceUrl?: string;
    fileKey?: string;
    coverFileKey?: string;
    tags?: string[];
    /** When set, creates the image-details row (with the given blur, may be null). */
    imageDetails?: { blurDataUrl: string | null };
  }): Promise<string> => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `rp-${crypto.randomUUID()}@example.com`,
      },
    });
    const data: Prisma.ItemCreateInput = {
      id: crypto.randomUUID(),
      user: { connect: { id: user.id } },
      kind: opts.kind,
      processingStatus: opts.status,
      sourceType: opts.sourceType,
      sourceUrl: opts.sourceUrl ?? null,
      fileKey: opts.fileKey ?? null,
      coverFileKey: opts.coverFileKey ?? null,
      tags: opts.tags ?? [],
    };
    if (opts.imageDetails) {
      data.imageDetails = {
        create: { blurDataUrl: opts.imageDetails.blurDataUrl },
      };
    }
    const item = await write.item.create({ data, select: { id: true } });
    return item.id;
  };

  const statusOf = async (id: string) => {
    const { read } = await import("@/lib/db");
    return read.item.findUniqueOrThrow({
      where: { id },
      select: { processingStatus: true, processingError: true },
    });
  };

  /** Find the batchTrigger call for a given task id and return its items. */
  const callFor = (taskId: string) =>
    batchTrigger.mock.calls.find((c) => c[0] === taskId)?.[1] as
      | { payload: { itemId: string }; options: Record<string, unknown> }[]
      | undefined;

  /** Find the single-run `trigger` call for a task id and return its payload. */
  const triggerPayload = (taskId: string) =>
    trigger.mock.calls.find((c) => c[0] === taskId)?.[1] as
      | { itemIds: string[] }
      | undefined;

  /** The options (3rd) arg of the `trigger` call for a task id. */
  const triggerOptions = (taskId: string) =>
    trigger.mock.calls.find((c) => c[0] === taskId)?.[2] as
      | Record<string, unknown>
      | undefined;

  test("routes error-group items per kind, flips them, skips no-pipeline items", async () => {
    const urlItem = await seed({
      kind: "webpage",
      status: "failed",
      sourceType: "url",
      sourceUrl: "https://example.com/x",
    });
    const imageItem = await seed({
      kind: "image",
      status: "failed",
      sourceType: "upload",
      fileKey: "u/photo.jpg",
    });
    const note = await seed({
      kind: "note",
      status: "failed",
      sourceType: "compose",
    });

    const result = await reprocessIssueGroup("failed");

    expect(result.triggered).toBe(2);

    const urlCall = callFor("classify-url");
    const imageCall = callFor("analyze-image");
    expect(urlCall?.map((i) => i.payload.itemId)).toEqual([urlItem]);
    expect(imageCall?.map((i) => i.payload.itemId)).toEqual([imageItem]);
    // Guardrails: per-user concurrencyKey, a per-item idempotency key (no
    // double-charge), and a filterable dashboard tag. No `priority` — a negative
    // priority delays the run (it's a createdAt offset), which stranded them.
    expect(urlCall?.[0].options).toMatchObject({
      concurrencyKey: expect.any(String),
      idempotencyKey: `reprocess:${urlItem}`,
      idempotencyKeyTTL: expect.any(String),
      tags: ["admin-reprocess"],
    });
    expect(urlCall?.[0].options).not.toHaveProperty("priority");

    // Error group → flipped to processing, error cleared
    for (const id of [urlItem, imageItem]) {
      const row = await statusOf(id);
      expect(row.processingStatus).toBe("processing");
      expect(row.processingError).toBeNull();
    }
    // The note has no pipeline — untouched
    expect((await statusOf(note)).processingStatus).toBe("failed");
  });

  test("incomplete group re-analyses in place without flipping status", async () => {
    const image = await seed({
      kind: "image",
      status: "completed",
      sourceType: "upload",
      fileKey: "u/photo.jpg",
    });

    const result = await reprocessIssueGroup("missing-visual-vector");

    expect(result.triggered).toBe(1);
    expect(callFor("analyze-image")?.map((i) => i.payload.itemId)).toEqual([
      image,
    ]);
    // Completed item stays completed — a failed re-run must not downgrade it
    expect((await statusOf(image)).processingStatus).toBe("completed");
  });

  test("missing-blur heals locally — no paid pipeline, no status flip", async () => {
    const image = await seed({
      kind: "image",
      status: "completed",
      sourceType: "upload",
      fileKey: "u/photo.jpg",
      imageDetails: { blurDataUrl: null },
    });
    // A cover-kind item (article) with a cover image but no blur is eligible too.
    const article = await seed({
      kind: "article",
      status: "completed",
      sourceType: "url",
      sourceUrl: "https://example.com/a",
      coverFileKey: "u/cover.jpg",
      imageDetails: { blurDataUrl: null },
    });

    const result = await reprocessIssueGroup("missing-blur");

    expect(result.triggered).toBe(2);
    // Routed to the cheap local blur backfill, NOT the paid capture tasks.
    expect(batchTrigger).not.toHaveBeenCalled();
    const payload = triggerPayload("backfill-blur-placeholders");
    expect(payload?.itemIds.sort()).toEqual([image, article].sort());
    // Batch idempotency: a rapid re-click of the same unhealed set can't
    // enqueue a second run (deduped by a deterministic key + TTL).
    expect(triggerOptions("backfill-blur-placeholders")).toMatchObject({
      tags: ["admin-reprocess"],
      idempotencyKey: expect.stringMatching(/^reprocess:blur:[0-9a-f]{64}$/),
      idempotencyKeyTTL: expect.any(String),
    });
    // Completed items stay completed — a heal must never flip status.
    expect((await statusOf(image)).processingStatus).toBe("completed");
    expect((await statusOf(article)).processingStatus).toBe("completed");
  });

  test("blur idempotency key is stable for the same batch, differs across batches", async () => {
    const seedBlur = () =>
      seed({
        kind: "image",
        status: "completed",
        sourceType: "upload",
        fileKey: "u/photo.jpg",
        imageDetails: { blurDataUrl: null },
      });
    await seedBlur();

    await reprocessIssueGroup("missing-blur");
    const firstKey = triggerOptions(
      "backfill-blur-placeholders",
    )?.idempotencyKey;

    // Same rows, second click → same key (would dedupe within the TTL).
    await reprocessIssueGroup("missing-blur");
    const secondKey = trigger.mock.calls
      .filter((c) => c[0] === "backfill-blur-placeholders")
      .at(-1)?.[2]?.idempotencyKey;
    expect(secondKey).toBe(firstKey);

    // A new item in the batch → different content → different key (runs).
    await seedBlur();
    await reprocessIssueGroup("missing-blur");
    const thirdKey = trigger.mock.calls
      .filter((c) => c[0] === "backfill-blur-placeholders")
      .at(-1)?.[2]?.idempotencyKey;
    expect(thirdKey).not.toBe(firstKey);
  });

  test("missing-blur skips items with no resolvable source image", async () => {
    // Missing blur but no fileKey/coverFileKey — nothing to download, so excluded.
    await seed({
      kind: "image",
      status: "completed",
      sourceType: "upload",
      imageDetails: { blurDataUrl: null },
    });

    const result = await reprocessIssueGroup("missing-blur");

    expect(result.triggered).toBe(0);
    expect(trigger).not.toHaveBeenCalled();
  });

  test("a URL-sourced image goes only to classify-url (not both tasks)", async () => {
    const urlImage = await seed({
      kind: "image",
      status: "failed",
      sourceType: "url",
      sourceUrl: "https://example.com/pic.jpg",
      fileKey: "u/rehosted.jpg",
    });

    await reprocessIssueGroup("failed");

    expect(callFor("classify-url")?.map((i) => i.payload.itemId)).toEqual([
      urlImage,
    ]);
    expect(callFor("analyze-image")).toBeUndefined();
  });

  test("restores error items and throws when an enqueue fails", async () => {
    const item = await seed({
      kind: "webpage",
      status: "failed",
      sourceType: "url",
      sourceUrl: "https://example.com/x",
    });
    batchTrigger.mockRejectedValue(new Error("trigger unavailable"));

    await expect(reprocessIssueGroup("failed")).rejects.toThrow(
      /Failed to enqueue/,
    );
    // Not stranded in `processing` — restored to failed with a concrete reason
    // so it stays visible and doesn't render as a bare "unknown".
    expect(await statusOf(item)).toMatchObject({
      processingStatus: "failed",
      processingError: "enqueue_failed",
    });
  });

  test("reprocesses a null-source image upload (matches the retry route)", async () => {
    // kind=image + fileKey, no sourceType → retryable; must not be excluded
    const nullSourceImage = await seed({
      kind: "image",
      status: "failed",
      fileKey: "u/photo.jpg",
    });

    await reprocessIssueGroup("failed");

    expect(callFor("analyze-image")?.map((i) => i.payload.itemId)).toEqual([
      nullSourceImage,
    ]);
  });

  test("skips items with empty source/file keys", async () => {
    await seed({
      kind: "webpage",
      status: "failed",
      sourceType: "url",
      sourceUrl: "",
    });
    await seed({
      kind: "image",
      status: "failed",
      sourceType: "upload",
      fileKey: "",
    });

    const result = await reprocessIssueGroup("failed");

    expect(result.triggered).toBe(0);
    expect(batchTrigger).not.toHaveBeenCalled();
  });

  test("throws on an unknown group key", async () => {
    await expect(reprocessIssueGroup("nope")).rejects.toThrow(
      /Unknown issue group/,
    );
  });
});
