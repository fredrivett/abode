/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { Prisma } from "@prisma/client";
import { tweetBackfillCandidateWhere } from "@/lib/items/tweet-backfill";

describe("tweetBackfillCandidateWhere integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createTweet = async (
    userId: string,
    opts: {
      coverFileKey?: string | null;
      media?: Prisma.InputJsonValue;
      card?: Prisma.InputJsonValue;
    },
  ) => {
    const { write } = await import("@/lib/db");
    return write.item.create({
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
            // Prisma leaves media/card NULL when the key is omitted
            ...(opts.media !== undefined && { media: opts.media }),
            ...(opts.card !== undefined && { card: opts.card }),
          },
        },
      },
      select: { id: true },
    });
  };

  test("selects only pre-rehost tweets that have an image to host", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `bf-${crypto.randomUUID()}@example.com`,
      },
    });

    // Candidates: no coverFileKey, and have media and/or a card
    const withMedia = await createTweet(user.id, {
      media: [{ type: "photo", url: "https://pbs.twimg.com/a.jpg" }],
    });
    const withCard = await createTweet(user.id, {
      card: {
        title: "t",
        url: "https://ex.com",
        imageUrl: "https://ex.com/c.jpg",
      },
    });

    // Excluded: already re-hosted (coverFileKey set)
    await createTweet(user.id, {
      coverFileKey: `${user.id}/cover.jpg`,
      media: [
        {
          type: "photo",
          url: "https://pbs.twimg.com/b.jpg",
          fileKey: `${user.id}/cover.jpg`,
        },
      ],
    });
    // Excluded: text-only tweet (no media, no card)
    await createTweet(user.id, {});
    // Excluded: not a tweet at all
    await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "image",
        fileKey: `${user.id}/photo.jpg`,
        processingStatus: "completed",
      },
    });

    const found = await read.item.findMany({
      where: tweetBackfillCandidateWhere(),
      select: { id: true },
    });

    expect(found.map((i) => i.id).sort()).toEqual(
      [withMedia.id, withCard.id].sort(),
    );
  });
});
