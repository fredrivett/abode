import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/types/item";
import { redactSensitiveItem } from "./redact-sensitive";

// Every field populated, so a leak shows up as a surviving value
function fullItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    kind: "document",
    processingStatus: "completed",
    processingError: "download_failed",
    fileKey: "user/page-1.jpg",
    coverFileKey: "user/cover.jpg",
    faviconFileKey: "user/favicon.png",
    sourceFileKey: "user/statement.pdf",
    meta: { width: 800, height: 1100, originalName: "bank-statement.pdf" },
    sourceType: "upload",
    sourceUrl: "https://bank.example/statement",
    captureSource: "web",
    title: "Bank statement",
    description: "Monthly statement",
    tags: ["finance"],
    userTags: ["bank"],
    notes: "Account 1234",
    createdAt: "2026-10-01T00:00:00.000Z",
    addedAt: "2026-10-01T00:00:00.000Z",
    objects: ["paper"],
    colors: [{ hex: "#ffffff", percentage: 90 }],
    ocrText: "Balance £1,000",
    captureDate: "2026-09-30T00:00:00.000Z",
    blurDataUrl: "data:image/webp;base64,AAAA",
    locations: [
      {
        id: "loc-1",
        source: "exif",
        latitude: 51.5,
        longitude: -0.1,
        neighborhood: null,
        city: "London",
        region: null,
        country: null,
        countryCode: null,
        formatted: null,
      },
    ],
    articleDetails: null,
    twitterDetails: null,
    instagramDetails: null,
    videoDetails: null,
    productDetails: null,
    bookDetails: null,
    noteDetails: { content: "secret note" },
    privacy: "sensitive",
    coverHidden: true,
    sharedAt: "2026-10-02T00:00:00.000Z",
    sharedHighlights: true,
    rooms: [
      {
        id: "room-1",
        name: "Finance",
        emoji: null,
        slug: "finance",
        type: "manual",
        username: "fred",
      },
    ],
    externalLinks: [{ url: "https://bank.example", platform: "web" }],
    ...overrides,
  } as Item;
}

describe("redactSensitiveItem", () => {
  it("passes standard and unlisted items through untouched", () => {
    for (const privacy of ["standard", "unlisted"] as const) {
      const item = fullItem({ privacy });
      expect(redactSensitiveItem(item)).toBe(item);
    }
  });

  it("passes an item without a privacy level through untouched", () => {
    const item = fullItem({ privacy: undefined });
    expect(redactSensitiveItem(item)).toBe(item);
  });

  it("keeps only what a blurred tile needs", () => {
    const redacted = redactSensitiveItem(fullItem());

    expect(redacted).toMatchObject({
      id: "item-1",
      kind: "document",
      processingStatus: "completed",
      createdAt: "2026-10-01T00:00:00.000Z",
      addedAt: "2026-10-01T00:00:00.000Z",
      blurDataUrl: "data:image/webp;base64,AAAA",
      privacy: "sensitive",
      redacted: true,
      // Layout dimensions only — never the original file name
      meta: { width: 800, height: 1100 },
    });
  });

  it("leaves no content behind", () => {
    const redacted = redactSensitiveItem(fullItem());
    const serialized = JSON.stringify(redacted);

    for (const secret of [
      "Bank statement",
      "Monthly statement",
      "bank-statement.pdf",
      "bank.example",
      "finance",
      "Account 1234",
      "Balance",
      "secret note",
      "London",
      "Finance",
      "user/",
      "paper",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    // Structured content the string scan can't see
    expect(redacted.colors).toEqual([]);
    expect(redacted.locations).toEqual([]);
    expect(redacted.objects).toEqual([]);
    expect(redacted.processingError).toBeNull();
    expect(redacted.coverHidden).toBe(false);
    expect(redacted.sharedAt).toBeNull();
  });

  it("keeps a book's cover dimensions and the upload-time LQIP", () => {
    const redacted = redactSensitiveItem(
      fullItem({
        kind: "book",
        meta: {
          coverWidth: 400,
          coverHeight: 600,
          blurDataUrl: "data:image/jpeg;base64,BBBB",
          isbn: "secret-isbn",
        },
      }),
    );
    expect(redacted.meta).toEqual({
      coverWidth: 400,
      coverHeight: 600,
      blurDataUrl: "data:image/jpeg;base64,BBBB",
    });
  });

  it("drops non-numeric meta rather than passing it through", () => {
    const redacted = redactSensitiveItem(
      fullItem({
        meta: {
          width: "800",
          height: 1100,
          blurDataUrl: "https://tracker.example/pixel.png",
        },
      }),
    );
    expect(redacted.meta).toEqual({ height: 1100 });
    expect(redactSensitiveItem(fullItem({ meta: { title: "x" } })).meta).toBe(
      null,
    );
  });

  it("keeps caller-specific extras such as a search match", () => {
    const redacted = redactSensitiveItem({
      ...fullItem(),
      match: { reasons: [{ field: "tags", value: "finance" }] },
    });
    expect(redacted.match).toEqual({
      reasons: [{ field: "tags", value: "finance" }],
    });
  });
});
