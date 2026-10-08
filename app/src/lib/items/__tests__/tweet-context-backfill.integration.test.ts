/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { fetchTweet } from "react-tweet/api";
import {
  refreshTweetContext,
  tweetContextBackfillCandidateWhere,
} from "@/lib/items/tweet-context-backfill";
import {
  articleTweet,
  longTweet,
  pollTweet,
} from "@/lib/twitter/__fixtures__/syndication";
import type { RawTweet } from "@/lib/twitter/transform-tweet";

type FetchResult = Awaited<ReturnType<typeof fetchTweet>>;

/** A fetchTweet stand-in that serves `tweet` (or another result) for any id */
function fetchReturning(result: FetchResult): typeof fetchTweet {
  return vi.fn(async () => result);
}

describe("tweet context backfill", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function createUser() {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `ctx-${crypto.randomUUID()}@example.com`,
      },
    });
  }

  /** A tweet saved before tweet context existed: raw text, no context */
  async function createTweet(
    userId: string,
    tweet: RawTweet,
    extra: { card?: object; authorAvatarFileKey?: string } = {},
  ) {
    const { write } = await import("@/lib/db");
    return write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        kind: "twitter",
        title: `Tweet by @${tweet.user.screen_name}`,
        processingStatus: "completed",
        twitterDetails: {
          create: {
            tweetId: tweet.id_str,
            authorUsername: tweet.user.screen_name,
            text: tweet.text,
            media: [{ type: "photo", url: "https://x/1", fileKey: "u/1.jpg" }],
            ...extra,
          },
        },
      },
      select: { id: true },
    });
  }

  test("selects every saved tweet, and nothing else", async () => {
    const { write, read } = await import("@/lib/db");
    const user = await createUser();
    const tweet = await createTweet(user.id, longTweet);
    // A twitter item whose capture never produced details
    await write.item.create({
      data: { id: crypto.randomUUID(), userId: user.id, kind: "twitter" },
    });
    await write.item.create({
      data: { id: crypto.randomUUID(), userId: user.id, kind: "note" },
    });

    const found = await read.item.findMany({
      where: tweetContextBackfillCandidateWhere(),
      select: { id: true },
    });
    expect(found.map((i) => i.id)).toEqual([tweet.id]);
  });

  test("fills in context columns, leaving media, card and avatar alone", async () => {
    const { read } = await import("@/lib/db");
    const user = await createUser();
    const linkCard = { title: "Kept", description: "", url: "https://a" };
    const item = await createTweet(user.id, pollTweet, {
      card: linkCard,
      authorAvatarFileKey: "u/avatar.jpg",
    });

    const result = await refreshTweetContext({
      itemId: item.id,
      fetch: fetchReturning({
        data: { ...pollTweet, note_tweet: { id: "n" } },
      }),
    });

    expect(result).toEqual({ refreshed: true, article: false });
    const details = await read.itemTwitterDetails.findUniqueOrThrow({
      where: { itemId: item.id },
    });
    expect(details.isTruncated).toBe(true);
    expect(details.poll).toMatchObject({ isFinal: true });
    expect(details.card).toEqual(linkCard);
    expect(details.media).toEqual([
      { type: "photo", url: "https://x/1", fileKey: "u/1.jpg" },
    ]);
    expect(details.authorAvatarFileKey).toBe("u/avatar.jpg");
  });

  test("gives an Article post its card, title and description", async () => {
    const { read } = await import("@/lib/db");
    const user = await createUser();
    const item = await createTweet(user.id, articleTweet);

    const result = await refreshTweetContext({
      itemId: item.id,
      fetch: fetchReturning({ data: articleTweet }),
    });

    expect(result).toEqual({ refreshed: true, article: true });
    const saved = await read.item.findUniqueOrThrow({
      where: { id: item.id },
      select: {
        title: true,
        description: true,
        twitterDetails: { select: { card: true, text: true } },
      },
    });
    expect(saved.title).toBe("What a year of composting taught me");
    expect(saved.twitterDetails?.text).toBe("Do the maths.");
    expect(saved.twitterDetails?.card).toMatchObject({
      type: "article",
      imageUrl: "https://pbs.twimg.com/media/compost.jpg",
    });
    // Descriptions come from the text when there is some
    expect(saved.description).toBe("Do the maths.");
  });

  test("keeps what was captured when X no longer serves the tweet", async () => {
    const { read } = await import("@/lib/db");
    const user = await createUser();
    const item = await createTweet(user.id, longTweet);

    const result = await refreshTweetContext({
      itemId: item.id,
      fetch: fetchReturning({ tombstone: true }),
    });

    expect(result).toEqual({ refreshed: false, skipped: "unavailable" });
    const details = await read.itemTwitterDetails.findUniqueOrThrow({
      where: { itemId: item.id },
    });
    expect(details.text).toBe(longTweet.text);
    expect(details.isTruncated).toBe(false);
  });

  test("skips an item without tweet details", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    const item = await write.item.create({
      data: { id: crypto.randomUUID(), userId: user.id, kind: "twitter" },
    });

    const fetch = fetchReturning({ data: longTweet });
    const result = await refreshTweetContext({ itemId: item.id, fetch });

    expect(result).toEqual({ refreshed: false, skipped: "no-details" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("doesn't clobber an item re-captured as another tweet meanwhile", async () => {
    const { read, write } = await import("@/lib/db");
    const user = await createUser();
    const item = await createTweet(user.id, longTweet);

    // The item is re-captured as a different tweet while X is being fetched
    const fetch: typeof fetchTweet = vi.fn(async () => {
      await write.itemTwitterDetails.update({
        where: { itemId: item.id },
        data: { tweetId: "999", text: "Newer capture" },
      });
      return { data: longTweet };
    });
    const result = await refreshTweetContext({ itemId: item.id, fetch });

    expect(result).toEqual({ refreshed: false, skipped: "superseded" });
    const details = await read.itemTwitterDetails.findUniqueOrThrow({
      where: { itemId: item.id },
    });
    expect(details).toMatchObject({ tweetId: "999", text: "Newer capture" });
  });

  test("keeps a card that was filled in while X was being fetched", async () => {
    const { read, write } = await import("@/lib/db");
    const user = await createUser();
    const item = await createTweet(user.id, articleTweet);
    const hostedCard = {
      type: "article",
      title: "What a year of composting taught me",
      description: "",
      url: "https://x.com/i/article/1900000000000000099",
      imageUrl: "https://pbs.twimg.com/media/compost.jpg",
      imageFileKey: `${user.id}/cover.jpg`,
    };

    // A re-capture lands (with a re-hosted cover) mid-fetch
    const fetch: typeof fetchTweet = vi.fn(async () => {
      await write.itemTwitterDetails.update({
        where: { itemId: item.id },
        data: { card: hostedCard },
      });
      return { data: articleTweet };
    });
    const result = await refreshTweetContext({ itemId: item.id, fetch });

    expect(result).toEqual({ refreshed: false, skipped: "superseded" });
    const details = await read.itemTwitterDetails.findUniqueOrThrow({
      where: { itemId: item.id },
    });
    expect(details.card).toEqual(hostedCard);
  });

  test("keeps a title the user edited when adding an Article card", async () => {
    const { read, write } = await import("@/lib/db");
    const user = await createUser();
    const item = await createTweet(user.id, articleTweet);
    await write.item.update({
      where: { id: item.id },
      data: { title: "My compost notes", titleEditedByUser: true },
    });

    const result = await refreshTweetContext({
      itemId: item.id,
      fetch: fetchReturning({ data: articleTweet }),
    });

    expect(result).toEqual({ refreshed: true, article: true });
    const saved = await read.item.findUniqueOrThrow({
      where: { id: item.id },
      select: { title: true },
    });
    expect(saved.title).toBe("My compost notes");
  });
});
