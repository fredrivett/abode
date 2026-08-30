/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";

// Stub only the paid embedding call — keep upsertTextVector real so the test
// exercises the actual vector write against the container DB. isOpenAiConfigured
// is mocked (default configured) so the guard is exercised deterministically,
// independent of whether OPENAI_API_KEY is present in the test env.
const generateTextEmbedding = vi.hoisted(() => vi.fn());
const isOpenAiConfigured = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/embeddings")>()),
  generateTextEmbedding,
  isOpenAiConfigured,
}));

const captureServerException = vi.hoisted(() => vi.fn());
vi.mock("@/lib/posthog-server", () => ({ captureServerException }));

const recordAiUsage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai-costs/record-ai-usage", () => ({ recordAiUsage }));

// The task file calls task()/logger at import — stub the SDK so it loads cleanly
// outside a run context.
vi.mock("@trigger.dev/sdk", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  task: (config: unknown) => config,
}));

import { backfillTextVectors } from "@app/trigger/backfill-text-vectors";

/** A valid 1536-dim vector so the real upsert satisfies the pgvector column. */
const VECTOR = Array.from({ length: 1536 }, () => 0.01);

describe("backfillTextVectors", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    generateTextEmbedding.mockReset();
    captureServerException.mockReset();
    recordAiUsage.mockReset();
    isOpenAiConfigured.mockReturnValue(true);
  });

  const seed = async (
    tags: string[],
  ): Promise<{ id: string; userId: string }> => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `bt-${crypto.randomUUID()}@example.com`,
      },
    });
    return write.item.create({
      data: {
        id: crypto.randomUUID(),
        user: { connect: { id: user.id } },
        kind: "webpage",
        processingStatus: "completed",
        tags,
      },
      select: { id: true, userId: true },
    });
  };

  const vectorCount = async (itemId: string): Promise<number> => {
    const { read } = await import("@/lib/db");
    const item = await read.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { textVectors: true },
    });
    return item.textVectors.length;
  };

  test("writes vectors for tagged items missing one, records billed usage", async () => {
    generateTextEmbedding.mockResolvedValue({
      embedding: VECTOR,
      totalTokens: 5,
    });
    const a = await seed(["design"]);
    const b = await seed(["typography"]);

    const result = await backfillTextVectors();

    expect(result).toMatchObject({ updated: 2, failed: 0 });
    expect(await vectorCount(a.id)).toBe(1);
    expect(await vectorCount(b.id)).toBe(1);
    expect(recordAiUsage).toHaveBeenCalledTimes(2);
  });

  test("reports failures and throws so retries re-run the still-missing rows", async () => {
    // A transient outage must not be masked as a skip — it surfaces for retry.
    generateTextEmbedding.mockRejectedValue(new Error("openai unavailable"));
    const a = await seed(["design"]);

    await expect(backfillTextVectors()).rejects.toThrow(/1 of 1 items failed/);
    expect(captureServerException).toHaveBeenCalledWith(
      expect.any(Error),
      a.userId,
      expect.objectContaining({
        task: "backfill-text-vectors",
        itemId: a.id,
      }),
    );
    // No vector written → the item stays in the missing-text-vector group.
    expect(await vectorCount(a.id)).toBe(0);
  });

  test("skips the whole sweep cleanly when OpenAI is unconfigured", async () => {
    isOpenAiConfigured.mockReturnValue(false);
    const a = await seed(["design"]);

    const result = await backfillTextVectors();

    // Clean no-op — no embedding call, no failure, item stays as-is (not stuck)
    expect(result).toEqual({ total: 0, updated: 0, skipped: 0, failed: 0 });
    expect(generateTextEmbedding).not.toHaveBeenCalled();
    expect(await vectorCount(a.id)).toBe(0);
  });

  test("scopes to itemIds and leaves other missing-vector items untouched", async () => {
    generateTextEmbedding.mockResolvedValue({
      embedding: VECTOR,
      totalTokens: 5,
    });
    const target = await seed(["design"]);
    const other = await seed(["typography"]);

    const result = await backfillTextVectors([target.id]);

    expect(result.total).toBe(1);
    expect(await vectorCount(target.id)).toBe(1);
    expect(await vectorCount(other.id)).toBe(0);
  });
});
