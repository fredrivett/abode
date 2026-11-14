/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";

// Only the paid embedding call and the $ budget reads are faked; the note reads
// and vector writes run against the container database
const generateTextEmbedding = vi.hoisted(() => vi.fn());
vi.mock("@/lib/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/embeddings")>()),
  generateTextEmbedding,
  isOpenAiConfigured: () => true,
}));

const budget = vi.hoisted(() => ({ enforced: true, userDailyUnder: true }));
vi.mock("@/lib/usage-limits", async (importOriginal) => {
  const under = (underBudget: boolean) => ({
    underBudget,
    spentUsd: 0,
    limitUsd: 1,
  });
  return {
    ...(await importOriginal<typeof import("@/lib/usage-limits")>()),
    isUsageLimitsEnforced: () => budget.enforced,
    assertUserDailyBudget: async () => under(budget.userDailyUnder),
    assertUserMonthlyBudget: async () => under(true),
    assertSystemDailyBudget: async () => under(true),
  };
});

vi.mock("@/lib/ai-costs/record-ai-usage", () => ({ recordAiUsage: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
  task: (config: unknown) => config,
}));

import { embedNote } from "./embed-note";

const VECTOR = Array.from({ length: 1536 }, () => 0.01);

describe("embedNote", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    generateTextEmbedding.mockReset();
    generateTextEmbedding.mockResolvedValue({
      embedding: VECTOR,
      totalTokens: 5,
    });
    budget.enforced = true;
    budget.userDailyUnder = true;
  });

  /** A note that already has a vector, as one saved before an edit would */
  const seedEmbeddedNote = async (content: string) => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: { id: crypto.randomUUID(), email: "embed@example.com" },
    });
    return write.item.create({
      data: {
        userId: user.id,
        kind: "note",
        processingStatus: "completed",
        title: "Weekend plans",
        userTags: ["baking"],
        noteDetails: { create: { content } },
        textVectors: {
          create: { userId: user.id, model: "text-embedding-3-small" },
        },
      },
      select: { id: true, userId: true },
    });
  };

  const vectorCount = async (itemId: string) => {
    const { read } = await import("@/lib/db");
    return read.itemTextVector.count({ where: { itemId } });
  };

  test("embeds the note's tags, title and body", async () => {
    const note = await seedEmbeddedNote("Pick up sourdough starter");

    expect(await embedNote({ itemId: note.id, userId: note.userId })).toEqual({
      success: true,
      outcome: "embedded",
    });
    expect(generateTextEmbedding).toHaveBeenCalledWith(
      "baking\n\nWeekend plans\n\nPick up sourdough starter",
    );
    expect(await vectorCount(note.id)).toBe(1);
  });

  test("over an enforced $ cap, spends nothing and drops the stale vector", async () => {
    budget.userDailyUnder = false;
    const note = await seedEmbeddedNote("Pick up sourdough starter");

    expect(await embedNote({ itemId: note.id, userId: note.userId })).toEqual({
      success: true,
      outcome: "over-budget",
    });
    expect(generateTextEmbedding).not.toHaveBeenCalled();
    expect(await vectorCount(note.id)).toBe(0);
  });

  test("in shadow mode an over-cap user is still embedded", async () => {
    budget.enforced = false;
    budget.userDailyUnder = false;
    const note = await seedEmbeddedNote("Pick up sourdough starter");

    expect(
      (await embedNote({ itemId: note.id, userId: note.userId })).outcome,
    ).toBe("embedded");
    expect(generateTextEmbedding).toHaveBeenCalledTimes(1);
  });
});
