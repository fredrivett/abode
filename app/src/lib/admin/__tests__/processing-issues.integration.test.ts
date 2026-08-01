/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { ItemKind, Prisma, ProcessingStatus } from "@prisma/client";
import { getProcessingIssues } from "@/lib/admin/processing-issues";

const HOUR = 60 * 60 * 1000;

describe("getProcessingIssues", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const seed = async (opts: {
    kind?: ItemKind;
    status: ProcessingStatus;
    startedAgoMs?: number;
    coverFileKey?: string;
    tags?: string[];
    withArticleDetails?: boolean;
    withNoteDetails?: boolean;
    withTextVector?: boolean;
    withVisualVector?: boolean;
  }): Promise<string> => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `pi-${crypto.randomUUID()}@example.com`,
      },
    });
    const data: Prisma.ItemCreateInput = {
      id: crypto.randomUUID(),
      user: { connect: { id: user.id } },
      kind: opts.kind,
      processingStatus: opts.status,
      processingStartedAt: new Date(Date.now() - (opts.startedAgoMs ?? 0)),
      coverFileKey: opts.coverFileKey ?? null,
      tags: opts.tags ?? [],
    };
    if (opts.withArticleDetails) data.articleDetails = { create: {} };
    if (opts.withNoteDetails) data.noteDetails = { create: {} };
    if (opts.withTextVector)
      data.textVectors = {
        create: { userId: user.id, model: "text-embedding-3-small" },
      };
    if (opts.withVisualVector)
      data.visualVectors = {
        create: { userId: user.id, model: "clip-vit-base-patch32" },
      };
    const item = await write.item.create({ data, select: { id: true } });
    return item.id;
  };

  /** Map of issue-group key → set of item ids currently in it. */
  const membership = async (): Promise<Map<string, Set<string>>> => {
    const groups = await getProcessingIssues();
    return new Map(
      groups.map((g) => [g.key, new Set(g.items.map((i) => i.id))]),
    );
  };

  test("detects failed and stuck items; recent processing isn't stuck", async () => {
    const failed = await seed({ status: "failed", kind: "webpage" });
    const stuck = await seed({
      status: "processing",
      kind: "webpage",
      startedAgoMs: 5 * HOUR,
    });
    const fresh = await seed({
      status: "processing",
      kind: "webpage",
      startedAgoMs: 5 * 60 * 1000,
    });

    const m = await membership();
    expect(m.get("failed")).toContain(failed);
    expect(m.get("stuck")).toContain(stuck);
    expect(m.get("stuck")).not.toContain(fresh);
  });

  test("missing-detail flags kinds with a detail table, excludes webpage", async () => {
    const article = await seed({ status: "completed", kind: "article" });
    const webpage = await seed({ status: "completed", kind: "webpage" });
    const okArticle = await seed({
      status: "completed",
      kind: "article",
      withArticleDetails: true,
      withTextVector: true,
    });

    const m = await membership();
    expect(m.get("missing-detail")).toContain(article);
    // webpage has no detail table — must not be flagged
    expect(m.get("missing-detail")).not.toContain(webpage);
    // a fully-populated article is in no group
    expect(m.get("missing-detail")).not.toContain(okArticle);
    expect(m.get("missing-text-vector")).not.toContain(okArticle);
    for (const ids of m.values()) expect(ids).not.toContain(okArticle);
  });

  test("missing-text-vector flags tagged items without a vector, excludes text-less ones", async () => {
    // Has tags (⇒ had embeddable content) but no vector → flagged
    const tagged = await seed({
      status: "completed",
      kind: "webpage",
      tags: ["design", "typography"],
    });
    // Tagged AND has a vector → not flagged (guards inverted filter)
    const okTagged = await seed({
      status: "completed",
      kind: "webpage",
      tags: ["design"],
      withTextVector: true,
    });
    // No tags ⇒ no embeddable text ⇒ legitimately no vector → not flagged, any kind
    const textless = await seed({ status: "completed", kind: "webpage" });
    const note = await seed({
      status: "completed",
      kind: "note",
      withNoteDetails: true,
    });

    const m = await membership();
    expect(m.get("missing-text-vector")).toContain(tagged);
    expect(m.get("missing-text-vector")).not.toContain(okTagged);
    expect(m.get("missing-text-vector")).not.toContain(textless);
    expect(m.get("missing-text-vector")).not.toContain(note);
  });

  test("missing-visual-vector: images always, cover kinds only with a cover", async () => {
    const image = await seed({ status: "completed", kind: "image" });
    const okImage = await seed({
      status: "completed",
      kind: "image",
      withVisualVector: true,
    });
    const coverlessTweet = await seed({ status: "completed", kind: "twitter" });
    const coveredTweet = await seed({
      status: "completed",
      kind: "twitter",
      coverFileKey: "u/cover.jpg",
    });

    const m = await membership();
    expect(m.get("missing-visual-vector")).toContain(image);
    // present vector excludes it (guards against an inverted filter)
    expect(m.get("missing-visual-vector")).not.toContain(okImage);
    // a tweet with no cover legitimately has no visual vector
    expect(m.get("missing-visual-vector")).not.toContain(coverlessTweet);
    expect(m.get("missing-visual-vector")).toContain(coveredTweet);
  });

  test("count matches the sample size for small groups", async () => {
    await seed({ status: "failed", kind: "webpage" });
    await seed({ status: "failed", kind: "image" });
    const groups = await getProcessingIssues();
    const failed = groups.find((g) => g.key === "failed");
    expect(failed?.count).toBe(2);
    expect(failed?.items).toHaveLength(2);
  });
});
