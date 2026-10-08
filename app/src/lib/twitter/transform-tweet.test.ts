import { describe, expect, it } from "vitest";
import {
  articleTweet,
  longTweet,
  longTweetWithPhoto,
  pollTweet,
  quoteTweet,
  replyTweet,
} from "./__fixtures__/syndication";
import {
  extractQuotedTweet,
  extractReplyContext,
  extractTweetCard,
  extractTweetPoll,
  normalizeTweetText,
  type RawTweet,
  transformTweetData,
  tweetDescriptionSource,
  tweetItemTitle,
  tweetSourceText,
} from "./transform-tweet";

const entities = { hashtags: [], urls: [], user_mentions: [], symbols: [] };

describe("normalizeTweetText", () => {
  it("returns null for a missing or empty text", () => {
    expect(normalizeTweetText({ text: "", display_text_range: [0, 0] })).toBe(
      null,
    );
  });

  it("keeps plain text as-is", () => {
    expect(
      normalizeTweetText({
        text: "Hello",
        display_text_range: [0, 5],
        entities,
      }),
    ).toBe("Hello");
  });

  it("decodes X's HTML escaping", () => {
    expect(
      normalizeTweetText({
        text: "salt &amp; pepper &lt;3 &gt;_&lt;",
        display_text_range: [0, 33],
        entities,
      }),
    ).toBe("salt & pepper <3 >_<");
  });

  it("drops the trailing link to attached media, even when the range overshoots", () => {
    const text = normalizeTweetText(longTweetWithPhoto);
    expect(text).not.toContain("t.co");
    expect(text?.endsWith("than the rest of")).toBe(true);
  });

  it("drops leading reply mentions and expands t.co links", () => {
    expect(normalizeTweetText(replyTweet)).toBe(
      "Treated bearers every time 👍 https://example.com/bearers",
    );
  });

  it("removes links dropUrl rejects, tidying the leftover space", () => {
    expect(
      normalizeTweetText(articleTweet, {
        dropUrl: (url) => url.includes("/i/article/"),
      }),
    ).toBe("Do the maths.");
  });

  it("returns null when only a dropped link remains", () => {
    expect(
      normalizeTweetText(
        {
          text: "https://t.co/a",
          display_text_range: [0, 14],
          entities: {
            ...entities,
            urls: [
              {
                url: "https://t.co/a",
                expanded_url: "https://x.com/i/article/1",
                display_url: "x.com/i/article/1",
                indices: [0, 14],
              },
            ],
          },
        },
        { dropUrl: () => true },
      ),
    ).toBe(null);
  });
});

describe("extractTweetCard", () => {
  it("builds an Article card from the Article's title, preview and cover", () => {
    expect(extractTweetCard(articleTweet)).toEqual({
      type: "article",
      title: "What a year of composting taught me",
      description: expect.stringContaining("Twelve months ago"),
      url: "https://x.com/i/article/1900000000000000099",
      imageUrl: "https://pbs.twimg.com/media/compost.jpg",
    });
  });

  it("leaves the cover null when an Article has none", () => {
    const tweet = {
      ...articleTweet,
      article: { rest_id: "9", title: "No cover" },
    } as RawTweet;
    expect(extractTweetCard(tweet)).toMatchObject({
      type: "article",
      description: "",
      imageUrl: null,
    });
  });

  it("builds a link card without a type", () => {
    const tweet = {
      ...longTweet,
      card: {
        url: "https://t.co/x",
        binding_values: {
          title: { string_value: "A page" },
          url: { string_value: "https://example.com" },
          thumbnail_image_large: { image_value: { url: "https://img/a.jpg" } },
        },
      },
    } as RawTweet;
    const card = extractTweetCard(tweet);
    expect(card).toEqual({
      title: "A page",
      description: "",
      url: "https://example.com",
      imageUrl: "https://img/a.jpg",
    });
    expect(card).not.toHaveProperty("type");
  });

  it("ignores a poll card (no title or description)", () => {
    expect(extractTweetCard(pollTweet)).toBe(null);
  });
});

describe("extractTweetPoll", () => {
  it("reads each option's label and vote count", () => {
    expect(extractTweetPoll(pollTweet)).toEqual({
      options: [
        { label: "Felt", votes: 312 },
        { label: "Corrugated", votes: 488 },
      ],
      endsAt: "2026-10-03T11:20:32Z",
      isFinal: true,
    });
  });

  it("marks a poll that's still open as not final, counting missing votes as 0", () => {
    const tweet = {
      ...pollTweet,
      card: {
        name: "poll3choice_text_only",
        binding_values: {
          choice1_label: { string_value: "A" },
          choice2_label: { string_value: "B" },
          choice3_label: { string_value: "C" },
          choice1_count: { string_value: "5" },
          counts_are_final: { boolean_value: false },
        },
      },
    } as RawTweet;
    expect(extractTweetPoll(tweet)).toEqual({
      options: [
        { label: "A", votes: 5 },
        { label: "B", votes: 0 },
        { label: "C", votes: 0 },
      ],
      endsAt: null,
      isFinal: false,
    });
  });

  it("returns null for non-poll cards and tweets without one", () => {
    expect(extractTweetPoll(longTweet)).toBe(null);
    expect(
      extractTweetPoll({
        ...longTweet,
        card: { name: "summary_large_image", binding_values: {} },
      } as RawTweet),
    ).toBe(null);
  });

  it("returns null for a poll card with fewer than two options", () => {
    const tweet = {
      ...pollTweet,
      card: {
        name: "poll2choice_text_only",
        binding_values: { choice1_label: { string_value: "Only" } },
      },
    } as RawTweet;
    expect(extractTweetPoll(tweet)).toBe(null);
  });
});

describe("extractQuotedTweet", () => {
  it("snapshots the quoted tweet, keeping only stills of its media", () => {
    expect(extractQuotedTweet(quoteTweet.quoted_tweet)).toEqual({
      tweetId: "1900000000000000001",
      authorName: "Jonah Pierce",
      authorUsername: "jonahpierce",
      authorAvatarUrl:
        "https://pbs.twimg.com/profile_images/1/jonahpierce_normal.jpg",
      text: expect.stringContaining("garden shed"),
      isTruncated: true,
      postedAt: "2026-10-01T20:23:00.000Z",
      media: [
        {
          type: "video",
          url: "https://pbs.twimg.com/media/shed-poster.jpg",
          posterUrl: "https://pbs.twimg.com/media/shed-poster.jpg",
          width: 1280,
          height: 720,
        },
      ],
    });
  });

  it("returns null when there's no quote or it has no author", () => {
    expect(extractQuotedTweet(undefined)).toBe(null);
    expect(
      extractQuotedTweet({
        ...quoteTweet.quoted_tweet,
        user: {},
      } as RawTweet["quoted_tweet"]),
    ).toBe(null);
  });
});

describe("extractReplyContext", () => {
  it("takes the parent's author and text when X includes it", () => {
    expect(extractReplyContext(replyTweet)).toEqual({
      tweetId: "1900000000000000001",
      authorUsername: "jonahpierce",
      authorName: "Jonah Pierce",
      text: "What do you all use under a shed?",
    });
  });

  it("falls back to the replied-to handle when the parent is missing", () => {
    const tweet = { ...replyTweet, parent: undefined } as RawTweet;
    expect(extractReplyContext(tweet)).toEqual({
      tweetId: "1900000000000000001",
      authorUsername: "jonahpierce",
      authorName: null,
      text: null,
    });
  });

  it("returns null for a tweet that isn't a reply", () => {
    expect(extractReplyContext(longTweet)).toBe(null);
  });
});

describe("transformTweetData", () => {
  it("flags a long-form post as truncated", () => {
    const details = transformTweetData(longTweet);
    expect(details.isTruncated).toBe(true);
    expect(details.text?.startsWith("Spent the weekend")).toBe(true);
  });

  it("turns an Article post into an Article card, dropping its link from the text", () => {
    const details = transformTweetData(articleTweet);
    expect(details.card?.type).toBe("article");
    expect(details.text).toBe("Do the maths.");
    expect(details.isTruncated).toBe(false);
  });

  it("captures the quoted tweet and drops its permalink from the text", () => {
    const tweet = {
      ...quoteTweet,
      text: "Must read https://t.co/q",
      display_text_range: [0, 24],
      entities: {
        ...entities,
        urls: [
          {
            url: "https://t.co/q",
            expanded_url:
              "https://x.com/jonahpierce/status/1900000000000000001",
            display_url: "x.com/jonahpierce/…",
            indices: [10, 24],
          },
        ],
      },
    } as RawTweet;
    const details = transformTweetData(tweet);
    expect(details.quotedTweetId).toBe("1900000000000000001");
    expect(details.quotedTweet?.authorUsername).toBe("jonahpierce");
    expect(details.text).toBe("Must read");
  });

  it("captures a poll and reply context", () => {
    expect(transformTweetData(pollTweet).poll?.options).toHaveLength(2);
    expect(transformTweetData(replyTweet).inReplyTo?.authorUsername).toBe(
      "jonahpierce",
    );
  });

  it("leaves context empty for a plain tweet", () => {
    const details = transformTweetData({
      ...longTweet,
      note_tweet: undefined,
    } as RawTweet);
    expect(details).toMatchObject({
      isTruncated: false,
      quotedTweet: null,
      poll: null,
      inReplyTo: null,
      card: null,
    });
  });
});

describe("item text helpers", () => {
  const article = transformTweetData(articleTweet);
  const plain = transformTweetData(longTweet);

  it("titles an Article by its own title, other tweets by author", () => {
    expect(tweetItemTitle(article)).toBe("What a year of composting taught me");
    expect(tweetItemTitle(plain)).toBe("Tweet by @jonahpierce");
  });

  it("describes a tweet by its text, falling back to an Article's preview", () => {
    expect(tweetDescriptionSource(plain)).toBe(plain.text);
    expect(tweetDescriptionSource({ ...article, text: null })).toContain(
      "Twelve months ago",
    );
    expect(tweetDescriptionSource({ text: null, card: null })).toBe(null);
  });

  it("gathers the text, Article, quote and poll for enrichment", () => {
    const source = tweetSourceText({
      text: "Mine",
      card: article.card,
      quotedTweet: transformTweetData(quoteTweet).quotedTweet,
      poll: transformTweetData(pollTweet).poll,
    });
    expect(source).toContain("Mine");
    expect(source).toContain("What a year of composting taught me");
    expect(source).toContain("Quoting @jonahpierce: Spent the weekend");
    expect(source).toContain("Poll: Felt / Corrugated");
    expect(
      tweetSourceText({
        text: null,
        card: null,
        quotedTweet: null,
        poll: null,
      }),
    ).toBe(undefined);
  });
});
