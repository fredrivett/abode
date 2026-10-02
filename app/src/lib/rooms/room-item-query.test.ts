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
      coverHidden: false,
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
  it("carries the card's hidden-cover setting", () => {
    expect(toClientRoomItem(row({ coverHidden: true })).coverHidden).toBe(true);
  });

  it("leaves absent details null", () => {
    const item = toClientRoomItem(row({}));
    expect(item).toMatchObject({
      articleDetails: null,
      twitterDetails: null,
      instagramDetails: null,
      videoDetails: null,
      productDetails: null,
      bookDetails: null,
      noteDetails: null,
    });
  });

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

  it("carries tweet and note details (cards render and size from them)", () => {
    const tweet = toClientRoomItem(
      row({
        kind: "twitter",
        twitterDetails: {
          tweetId: "1",
          authorName: "A",
          authorUsername: "a",
          authorAvatarUrl: null,
          text: "hello",
          textTruncated: false,
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

  it("carries Instagram, video, product and book details too", () => {
    const instagram = toClientRoomItem(
      row({
        kind: "instagram",
        instagramDetails: {
          postId: "p",
          mediaType: "image",
          authorName: null,
          authorUsername: "a",
          caption: "cap",
          postedAt: posted,
          media: [{ url: "m", width: 4, height: 5 }],
          likeCount: 1,
          commentCount: 2,
          coverMediaIndex: 0,
        },
      }),
    );
    expect(instagram.instagramDetails).toMatchObject({
      caption: "cap",
      postedAt: "2026-01-02T03:04:05.000Z",
      media: [{ width: 4, height: 5 }],
    });

    const video = toClientRoomItem(
      row({
        kind: "video",
        videoDetails: {
          platform: "youtube",
          videoId: "v",
          channelName: "c",
          channelUrl: null,
          duration: 60,
          embedUrl: null,
          thumbnailUrl: "t",
        },
      }),
    );
    expect(video.videoDetails).toMatchObject({ videoId: "v", duration: 60 });

    const product = toClientRoomItem(
      row({
        kind: "product",
        productDetails: {
          domain: "shop.example",
          brand: "B",
          price: null,
          currency: null,
          availability: null,
          images: [{ url: "i", width: 1, height: 1 }],
          coverImageIndex: 0,
        },
      }),
    );
    expect(product.productDetails).toMatchObject({
      brand: "B",
      images: [{ width: 1, height: 1 }],
    });

    const book = toClientRoomItem(
      row({
        kind: "book",
        bookDetails: {
          authors: ["Author"],
          publisher: null,
          publishedAt: null,
          isbn: null,
          pageCount: 200,
          domain: null,
          status: null,
          startedAt: null,
          startedAtPrecision: null,
          finishedAt: null,
          finishedAtPrecision: null,
          rating: null,
          review: null,
        },
      }),
    );
    expect(book.bookDetails).toMatchObject({
      authors: ["Author"],
      pageCount: 200,
    });
  });
});
