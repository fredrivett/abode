import { describe, expect, it } from "vitest";
import { documentPage, itemRow } from "./__tests__/fixtures";
import {
  roomFilterStrings,
  toExportItem,
  toExportNoteDraft,
  toExportProfile,
  uploadedAvatarKey,
  withoutStorageInternals,
} from "./serialize";

describe("withoutStorageInternals", () => {
  it("drops storage keys and blur placeholders at any depth, keeping the rest", () => {
    expect(
      withoutStorageInternals([
        {
          type: "photo",
          url: "https://x/1",
          fileKey: "u/1.jpg",
          blurDataUrl: "data:image/png;base64,AAAA",
          nested: { imageFileKey: "u/2.jpg", width: 10 },
        },
      ]),
    ).toEqual([{ type: "photo", url: "https://x/1", nested: { width: 10 } }]);
  });
});

describe("toExportItem", () => {
  it("renames AI tags, keeps only meaningful meta, and strips keys from media", () => {
    const item = toExportItem(
      itemRow({
        kind: "twitter",
        tags: ["ai"],
        userTags: ["mine"],
        meta: {
          originalName: "a.jpg",
          size: 10,
          blurDataUrl: "data:…",
          aspectHint: 1.5,
        },
        twitterDetails: {
          tweetId: "1",
          authorName: "A",
          authorUsername: "a",
          authorAvatarUrl: null,
          authorAvatarFileKey: "u/avatar.jpg",
          text: "hello",
          postedAt: null,
          media: [{ type: "photo", url: "https://x/1", fileKey: "u/1.jpg" }],
          quotedTweetId: null,
          card: { url: "https://ex.com", imageFileKey: "u/c.jpg" },
          coverMediaIndex: 0,
        },
      }),
    );

    expect(item.aiTags).toEqual(["ai"]);
    expect(item.userTags).toEqual(["mine"]);
    expect(item).not.toHaveProperty("tags");
    expect(item.meta).toEqual({ originalName: "a.jpg", size: 10 });
    expect(item.twitter?.media).toEqual([
      { type: "photo", url: "https://x/1" },
    ]);
    expect(item.twitter?.card).toEqual({ url: "https://ex.com" });
    expect(item.twitter).not.toHaveProperty("authorAvatarFileKey");
  });

  it("groups document pages (without their keys) and leaves absent details null", () => {
    const item = toExportItem(
      itemRow({
        kind: "document",
        documentPages: [documentPage(0, { ocrText: "p1" })],
      }),
    );
    expect(item.document).toEqual({
      pages: [
        { position: 0, filter: "bw", width: 100, height: 140, ocrText: "p1" },
      ],
    });
    expect(item.article).toBeNull();
    expect(toExportItem(itemRow()).document).toBeNull();
  });

  it("lists the item's files as archive paths, never storage keys", () => {
    const item = toExportItem(
      itemRow({
        id: "item-1",
        fileKey: "u/aaa.jpg",
        coverFileKey: "u/bbb.png",
        faviconFileKey: "u/ccc.ico",
      }),
    );
    expect(item.files).toEqual([
      { name: "original.jpg", path: "files/item-1/original.jpg" },
      { name: "cover.png", path: "files/item-1/cover.png" },
      { name: "favicon.ico", path: "files/item-1/favicon.ico" },
    ]);
    const json = JSON.stringify(item);
    expect(json).not.toContain("u/aaa.jpg");
    expect(json).not.toMatch(/fileKey/i);
  });

  it("never serializes a storage key anywhere in the item", () => {
    const json = JSON.stringify(
      toExportItem(
        itemRow({
          productDetails: {
            domain: "shop.com",
            brand: null,
            price: "10",
            currency: "GBP",
            availability: null,
            images: [{ fileKey: "u/p.jpg", url: "https://shop/p.jpg" }],
            coverImageIndex: 0,
          },
        }),
      ),
    );
    expect(json).not.toMatch(/fileKey/i);
  });
});

describe("roomFilterStrings", () => {
  it("serializes smart-room filters to search-box syntax, skipping junk", () => {
    expect(
      roomFilterStrings([
        { id: "a", type: "tag", value: "design", negated: false },
        { id: "b", type: "status", value: "read", negated: true },
        { nonsense: true },
      ]),
    ).toEqual(["@tag:design", "-@status:read"]);
  });

  it("returns nothing for missing or malformed filters", () => {
    expect(roomFilterStrings(null)).toEqual([]);
    expect(roomFilterStrings({ type: "tag" })).toEqual([]);
  });
});

describe("toExportNoteDraft", () => {
  it("drops an empty draft", () => {
    const at = new Date();
    expect(
      toExportNoteDraft({ content: "  ", createdAt: at, updatedAt: at }),
    ).toBeNull();
    expect(toExportNoteDraft(null)).toBeNull();
  });
});

describe("toExportProfile", () => {
  const profile = {
    email: "a@example.com",
    username: "a",
    previousUsernames: null,
    firstName: null,
    lastName: null,
    website: null,
    bio: null,
    avatarUrl:
      "http://127.0.0.1:54321/storage/v1/object/public/avatars/u1/avatar.png?t=1",
    avatarSource: "upload" as const,
    memberNumber: 1,
    createdAt: new Date(),
    showInvitedBy: true,
    showInvited: true,
    allowSearchIndexing: false,
    dismissedAutoRooms: [],
  };

  it("points an uploaded avatar at its copy in the archive", () => {
    expect(uploadedAvatarKey(profile)).toBe("u1/avatar.png");
    expect(toExportProfile(profile).avatarFile).toBe(
      "files/profile/avatar.png",
    );
  });

  it("doesn't copy OAuth or Gravatar avatars", () => {
    const oauth = { ...profile, avatarSource: "oauth" as const };
    expect(uploadedAvatarKey(oauth)).toBeNull();
    expect(toExportProfile(oauth).avatarFile).toBeNull();
  });
});
