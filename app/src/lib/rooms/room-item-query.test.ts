import { describe, expect, it } from "vitest";
import { type RoomItemRow, toClientRoomItem } from "./room-item-query";

const posted = new Date("2026-01-02T03:04:05.000Z");

function row(item: Partial<RoomItemRow["item"]>): RoomItemRow {
  return {
    id: "room-item-1",
    addedAt: posted,
    item: {
      id: "item-1",
      kind: null,
      processingStatus: "completed",
      fileKey: null,
      meta: null,
      sourceType: "upload",
      sourceUrl: null,
      captureSource: null,
      coverFileKey: null,
      faviconFileKey: null,
      createdAt: posted,
      title: "Title",
      description: null,
      tags: [],
      userTags: [],
      locations: [],
      imageDetails: null,
      articleDetails: null,
      twitterDetails: null,
      instagramDetails: null,
      videoDetails: null,
      productDetails: null,
      bookDetails: null,
      noteDetails: null,
      ...item,
    },
  };
}

describe("toClientRoomItem", () => {
  it("flattens the row and serializes dates", () => {
    const item = toClientRoomItem(row({}));
    expect(item).toMatchObject({
      roomItemId: "room-item-1",
      id: "item-1",
      addedAt: "2026-01-02T03:04:05.000Z",
      createdAt: "2026-01-02T03:04:05.000Z",
      // Private to the owner — never on a room page
      notes: null,
    });
  });

  it("carries every kind's details (cards render and size from them)", () => {
    const tweet = toClientRoomItem(
      row({
        kind: "twitter",
        twitterDetails: {
          tweetId: "1",
          authorName: "A",
          authorUsername: "a",
          authorAvatarUrl: null,
          text: "hello",
          postedAt: posted,
          media: [{ url: "m", width: 3, height: 2 }],
          quotedTweetId: null,
          card: null,
          coverMediaIndex: 0,
        },
      }),
    );
    expect(tweet.twitterDetails).toMatchObject({
      text: "hello",
      postedAt: "2026-01-02T03:04:05.000Z",
      media: [{ width: 3, height: 2 }],
    });

    const note = toClientRoomItem(
      row({ kind: "note", noteDetails: { content: "body" } }),
    );
    expect(note.noteDetails).toEqual({ content: "body" });
  });

  it("never exposes article read state", () => {
    const article = toClientRoomItem(
      row({
        kind: "article",
        articleDetails: {
          author: null,
          domain: "example.com",
          publishedAt: null,
          readingTime: 3,
          content: null,
        },
      }),
    );
    expect(article.articleDetails).toMatchObject({
      readAt: null,
      scrollProgress: null,
      progressUpdatedAt: null,
    });
  });
});
