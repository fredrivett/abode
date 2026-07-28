/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import {
  coverNeedsAnalysis,
  tweetCoverAnalysisBackfillWhere,
} from "@/lib/items/tweet-cover-analysis-backfill";

describe("tweet cover-analysis backfill selection", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createTweet = async (
    userId: string,
    opts: { coverFileKey?: string | null; analysisFileKey?: string },
  ) => {
    const { write } = await import("@/lib/db");
    const item = await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        kind: "twitter",
        coverFileKey: opts.coverFileKey ?? null,
        processingStatus: "completed",
        twitterDetails: {
          create: {
            tweetId: crypto.randomUUID(),
            authorUsername: "someone",
          },
        },
      },
      select: { id: true },
    });
    if (opts.analysisFileKey) {
      await write.itemMediaAnalysis.create({
        data: { itemId: item.id, userId, fileKey: opts.analysisFileKey },
      });
    }
    return item;
  };

  // Mirrors the backfill task's selection: prefilter query + per-cover predicate.
  const selectCandidates = async () => {
    const { read } = await import("@/lib/db");
    const items = await read.item.findMany({
      where: tweetCoverAnalysisBackfillWhere(),
      select: {
        id: true,
        coverFileKey: true,
        mediaAnalyses: { select: { fileKey: true } },
      },
    });
    return items
      .filter((it) => it.coverFileKey)
      .filter((it) =>
        coverNeedsAnalysis(
          it.coverFileKey as string,
          it.mediaAnalyses.map((m) => m.fileKey),
        ),
      )
      .map((it) => it.id);
  };

  test("selects tweets whose current cover has no analysis", async () => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `bca-${crypto.randomUUID()}@example.com`,
      },
    });

    // Candidate: re-hosted cover, nothing analysed
    const fresh = await createTweet(user.id, {
      coverFileKey: `${user.id}/cover.jpg`,
    });
    // Candidate: only an OLD cover is analysed; the current cover isn't
    const swappedUnanalysed = await createTweet(user.id, {
      coverFileKey: `${user.id}/new.jpg`,
      analysisFileKey: `${user.id}/old.jpg`,
    });

    // Excluded: the current cover is analysed
    await createTweet(user.id, {
      coverFileKey: `${user.id}/done.jpg`,
      analysisFileKey: `${user.id}/done.jpg`,
    });
    // Excluded: not re-hosted
    await createTweet(user.id, { coverFileKey: null });
    // Excluded: not a tweet
    await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "image",
        coverFileKey: `${user.id}/photo.jpg`,
        processingStatus: "completed",
      },
    });

    const found = await selectCandidates();
    expect(found.sort()).toEqual([fresh.id, swappedUnanalysed.id].sort());
  });
});
