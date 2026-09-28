/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { tweetAvatarBackfillCandidateWhere } from "@/lib/items/tweet-avatar-backfill";

describe("tweetAvatarBackfillCandidateWhere integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createTweet = async (
    userId: string,
    opts: { authorAvatarUrl?: string | null; authorAvatarFileKey?: string },
  ) => {
    const { write } = await import("@/lib/db");
    return write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        kind: "twitter",
        processingStatus: "completed",
        twitterDetails: {
          create: {
            tweetId: crypto.randomUUID(),
            authorUsername: "someone",
            authorAvatarUrl: opts.authorAvatarUrl ?? null,
            ...(opts.authorAvatarFileKey !== undefined && {
              authorAvatarFileKey: opts.authorAvatarFileKey,
            }),
          },
        },
      },
      select: { id: true },
    });
  };

  test("selects only tweets with a hotlinked avatar to re-host", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `av-${crypto.randomUUID()}@example.com`,
      },
    });

    // Candidate: has an avatar URL but no re-hosted key
    const hotlinked = await createTweet(user.id, {
      authorAvatarUrl: "https://pbs.twimg.com/avatar.jpg",
    });

    // Excluded: already re-hosted
    await createTweet(user.id, {
      authorAvatarUrl: "https://pbs.twimg.com/avatar.jpg",
      authorAvatarFileKey: `${user.id}/avatar.jpg`,
    });
    // Excluded: no avatar URL to re-host
    await createTweet(user.id, { authorAvatarUrl: null });
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
      where: tweetAvatarBackfillCandidateWhere(),
      select: { id: true },
    });

    expect(found.map((i) => i.id)).toEqual([hotlinked.id]);
  });
});
