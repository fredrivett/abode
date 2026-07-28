/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { tweetCoverAnalysisBackfillWhere } from "@/lib/items/tweet-cover-analysis-backfill";

describe("tweetCoverAnalysisBackfillWhere integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createTweet = async (
    userId: string,
    opts: { coverFileKey?: string | null; analysed?: boolean },
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
    if (opts.analysed && opts.coverFileKey) {
      await write.itemMediaAnalysis.create({
        data: {
          itemId: item.id,
          userId,
          fileKey: opts.coverFileKey,
        },
      });
    }
    return item;
  };

  test("selects re-hosted tweets with no cover analysis yet", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `bca-${crypto.randomUUID()}@example.com`,
      },
    });

    // Candidate: has a re-hosted cover, not yet analysed
    const candidate = await createTweet(user.id, {
      coverFileKey: `${user.id}/cover.jpg`,
    });

    // Excluded: already analysed (has a media-analysis row)
    await createTweet(user.id, {
      coverFileKey: `${user.id}/done.jpg`,
      analysed: true,
    });
    // Excluded: not re-hosted (no coverFileKey)
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

    const found = await read.item.findMany({
      where: tweetCoverAnalysisBackfillWhere(),
      select: { id: true },
    });

    expect(found.map((i) => i.id)).toEqual([candidate.id]);
  });
});
