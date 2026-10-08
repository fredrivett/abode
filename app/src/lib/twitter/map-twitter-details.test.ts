import { describe, expect, it } from "vitest";
import {
  mapTwitterDetails,
  type TwitterDetailsRow,
} from "./map-twitter-details";
import { tweetPreviewText } from "./preview-text";
import {
  parseQuotedTweet,
  parseTweetPoll,
  toReplyContext,
} from "./tweet-context";

const quotedTweet = {
  tweetId: "2",
  authorName: null,
  authorUsername: "quoted",
  authorAvatarUrl: null,
  text: "Quoted text",
  isTruncated: false,
  postedAt: null,
  media: null,
};

const poll = {
  options: [
    { label: "Yes", votes: 3 },
    { label: "No", votes: 1 },
  ],
  endsAt: null,
  isFinal: true,
};

const row: TwitterDetailsRow = {
  tweetId: "1",
  authorName: "A",
  authorUsername: "a",
  authorAvatarUrl: "https://pbs.twimg.com/a.jpg",
  authorAvatarFileKey: "u/avatar.jpg",
  text: "hello",
  isTruncated: true,
  postedAt: new Date("2026-01-02T03:04:05.000Z"),
  media: [{ type: "photo", url: "https://x/1" }],
  quotedTweetId: "2",
  quotedTweet,
  card: null,
  poll,
  coverMediaIndex: 0,
  inReplyToTweetId: "3",
  inReplyToAuthorUsername: "parent",
  inReplyToAuthorName: "Parent",
  inReplyToText: "Parent text",
};

describe("parseQuotedTweet / parseTweetPoll", () => {
  it("accept JSON matching their schema", () => {
    expect(parseQuotedTweet(quotedTweet)).toEqual(quotedTweet);
    expect(parseTweetPoll(poll)).toEqual(poll);
  });

  it("return null for missing or malformed JSON instead of throwing", () => {
    expect(parseQuotedTweet(null)).toBe(null);
    expect(parseQuotedTweet({ tweetId: "2" })).toBe(null);
    expect(parseTweetPoll("nope")).toBe(null);
    expect(
      parseTweetPoll({ ...poll, options: [{ label: "x", votes: -1 }] }),
    ).toBe(null);
  });
});

describe("toReplyContext", () => {
  it("rebuilds the reply from its flat columns", () => {
    expect(toReplyContext(row)).toEqual({
      tweetId: "3",
      authorUsername: "parent",
      authorName: "Parent",
      text: "Parent text",
    });
  });

  it("is null for a tweet that isn't a reply", () => {
    expect(
      toReplyContext({
        inReplyToTweetId: null,
        inReplyToAuthorUsername: null,
        inReplyToAuthorName: null,
        inReplyToText: null,
      }),
    ).toBe(null);
  });
});

describe("mapTwitterDetails", () => {
  it("maps every column the renderers read", () => {
    expect(mapTwitterDetails(row)).toEqual({
      tweetId: "1",
      authorName: "A",
      authorUsername: "a",
      authorAvatarUrl: "https://pbs.twimg.com/a.jpg",
      authorAvatarFileKey: "u/avatar.jpg",
      text: "hello",
      isTruncated: true,
      postedAt: "2026-01-02T03:04:05.000Z",
      media: [{ type: "photo", url: "https://x/1" }],
      quotedTweetId: "2",
      quotedTweet,
      card: null,
      poll,
      inReplyTo: {
        tweetId: "3",
        authorUsername: "parent",
        authorName: "Parent",
        text: "Parent text",
      },
      coverMediaIndex: 0,
    });
  });

  it("drops a malformed quote or poll rather than passing it to the UI", () => {
    const details = mapTwitterDetails({
      ...row,
      quotedTweet: { broken: true },
      poll: { options: [] },
    });
    expect(details.quotedTweet).toBe(null);
    expect(details.poll).toBe(null);
  });
});

describe("tweetPreviewText", () => {
  const article = {
    type: "article" as const,
    title: "Article title",
    description: "",
    url: "https://x.com/i/article/1",
    imageUrl: null,
  };

  it("prefers the tweet's own text", () => {
    expect(tweetPreviewText({ text: "Mine", card: article })).toBe("Mine");
  });

  it("falls back to an Article's title, but not a link card's", () => {
    expect(tweetPreviewText({ text: null, card: article })).toBe(
      "Article title",
    );
    expect(
      tweetPreviewText({ text: null, card: { ...article, type: undefined } }),
    ).toBe(null);
  });
});
