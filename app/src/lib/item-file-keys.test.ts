import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  collectCapturedFileKeys,
  collectItemFileKeys,
  type ItemFileKeysSource,
  itemFileKeysSelect,
  listItemFiles,
} from "./item-storage";
import { fileKeyStrings } from "./items/__tests__/file-key-strings";

/**
 * Guardrail for the item file-key inventory (`itemFileKeysSelect`). Delete,
 * reclaim, the image proxy and export all find an item's files through it, and
 * three hand-kept copies once drifted apart: deleting an item leaked its cover,
 * favicon and re-hosted images, and re-hosted tweet avatars 404'd in the proxy.
 * A new schema column that can hold a storage key must be classified here.
 */

// `…FileKey` columns that point at a key the item already owns elsewhere
const KEY_REFERENCES_NOT_OWNED: Record<string, string> = {
  "ItemMediaAnalysis.fileKey":
    "analysis cache keyed by one of the item's own image keys",
};

// JSON columns that never hold a storage key
const JSON_FIELDS_WITHOUT_FILE_KEYS: Record<string, string> = {
  "Item.meta": "file metadata: size, dimensions, blur placeholder, source ids",
  "Item.externalLinks": "external URLs only",
  "ItemLocation.raw": "raw geocoding payload",
  "ItemMediaAnalysis.colors": "colour palette",
  "ItemMediaAnalysis.visionData": "raw vision API response",
  "ItemImageDetails.colors": "colour palette",
  "ItemImageDetails.visionData": "raw vision API response",
};

const FILE_KEY_COLUMN = /filekey$/i;

type Selection = Record<string, unknown>;

/** Item plus every model it owns through a relation (not its owning user) */
function itemOwnedModels() {
  const models = new Map(
    Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
  );
  const item = models.get("Item");
  if (!item) throw new Error("Item model missing from DMMF");

  const owned: { model: typeof item; selection: Selection | undefined }[] = [
    { model: item, selection: itemFileKeysSelect },
  ];
  for (const field of item.fields) {
    if (field.kind !== "object" || field.type === "User") continue;
    const model = models.get(field.type);
    if (!model) throw new Error(`Unknown relation model ${field.type}`);
    const relation = (itemFileKeysSelect as Selection)[field.name];
    const selection =
      relation && typeof relation === "object" && "select" in relation
        ? (relation.select as Selection)
        : undefined;
    owned.push({ model, selection });
  }
  return owned;
}

describe("item file-key inventory", () => {
  it("selects every column that can hold one of the item's storage keys", () => {
    const unclassified: string[] = [];

    for (const { model, selection } of itemOwnedModels()) {
      for (const field of model.fields) {
        const id = `${model.name}.${field.name}`;
        const selected = selection?.[field.name] === true;
        const holdsKey =
          (field.kind === "scalar" && FILE_KEY_COLUMN.test(field.name)) ||
          field.type === "Json";
        if (!holdsKey || selected) continue;
        if (id in KEY_REFERENCES_NOT_OWNED) continue;
        if (id in JSON_FIELDS_WITHOUT_FILE_KEYS) continue;
        unclassified.push(id);
      }
    }

    expect(
      unclassified,
      "These columns may hold storage keys but aren't in itemFileKeysSelect " +
        "(@/lib/item-storage). Add them there (and to collectCapturedFileKeys " +
        "+ itemOwningImageKeyWhere), or classify them in this test.",
    ).toEqual([]);
  });

  it("doesn't carry stale exemptions", () => {
    const columns = new Set(
      itemOwnedModels().flatMap(({ model }) =>
        model.fields.map((field) => `${model.name}.${field.name}`),
      ),
    );
    const exempt = [
      ...Object.keys(KEY_REFERENCES_NOT_OWNED),
      ...Object.keys(JSON_FIELDS_WITHOUT_FILE_KEYS),
    ];
    expect(exempt.filter((id) => !columns.has(id))).toEqual([]);
  });
});

// Every selected location populated with a distinct key. Typed against the
// select, so a new column there fails to compile until it's filled in here.
const everyLocation: ItemFileKeysSource = {
  fileKey: "u/file.jpg",
  coverFileKey: "u/cover.jpg",
  faviconFileKey: "u/favicon.png",
  sourceFileKey: "u/source.pdf",
  productDetails: {
    images: [
      { fileKey: "u/product-1.jpg", url: "https://shop/1.jpg" },
      { fileKey: "u/product-2.jpg", url: "https://shop/2.jpg" },
    ],
  },
  twitterDetails: {
    media: [
      { type: "photo", url: "https://x/1", fileKey: "u/tweet-photo.jpg" },
      {
        type: "video",
        posterUrl: "https://x/2",
        fileKey: "u/tweet-poster.jpg",
      },
    ],
    card: { url: "https://ex.com", imageFileKey: "u/tweet-card.jpg" },
    authorAvatarFileKey: "u/tweet-avatar.jpg",
  },
  instagramDetails: {
    media: [{ type: "image", url: "https://ig/1", fileKey: "u/ig-1.jpg" }],
  },
  documentPages: [
    {
      position: 1,
      fileKey: "u/page-2.jpg",
      originalFileKey: "u/page-2-colour.jpg",
    },
    {
      position: 0,
      fileKey: "u/page-1.jpg",
      originalFileKey: "u/page-1-colour.jpg",
    },
  ],
};

describe("collectItemFileKeys", () => {
  it("returns every key the item holds, wherever it lives", () => {
    const keys = collectItemFileKeys(everyLocation);
    expect(new Set(keys)).toEqual(fileKeyStrings(everyLocation));
    expect(keys).toHaveLength(new Set(keys).size);
  });

  it("de-duplicates a key held in two places (cover mirrored from media)", () => {
    const keys = collectItemFileKeys({
      ...everyLocation,
      coverFileKey: "u/tweet-photo.jpg",
    });
    expect(keys.filter((key) => key === "u/tweet-photo.jpg")).toHaveLength(1);
  });

  it("returns nothing for an item without files", () => {
    expect(
      collectItemFileKeys({
        fileKey: null,
        coverFileKey: null,
        faviconFileKey: null,
        sourceFileKey: null,
        productDetails: null,
        twitterDetails: null,
        instagramDetails: null,
        documentPages: [],
      }),
    ).toEqual([]);
  });
});

describe("collectCapturedFileKeys", () => {
  it("excludes document pages, which reclaim handles separately", () => {
    const { documentPages, ...captured } = everyLocation;
    const keys = collectCapturedFileKeys(captured);

    expect(new Set(keys)).toEqual(fileKeyStrings(captured));
    for (const key of fileKeyStrings(documentPages)) {
      expect(keys).not.toContain(key);
    }
  });
});

describe("listItemFiles", () => {
  it("names every file collectItemFileKeys finds, once each", () => {
    const files = listItemFiles(everyLocation);
    expect(new Set(files.map(({ key }) => key))).toEqual(
      new Set(collectItemFileKeys(everyLocation)),
    );
    expect(new Set(files.map(({ name }) => name)).size).toBe(files.length);
  });

  it("gives each file a readable name that keeps its extension", () => {
    expect(listItemFiles(everyLocation).map(({ name }) => name)).toEqual([
      "page-01.jpg",
      "page-01-original.jpg",
      "page-02.jpg",
      "page-02-original.jpg",
      "original.jpg",
      "source.pdf",
      "cover.jpg",
      "favicon.png",
      "product-1.jpg",
      "product-2.jpg",
      "media-1.jpg",
      "media-2.jpg",
      "media-3.jpg",
      "card.jpg",
      "author-avatar.jpg",
    ]);
  });

  it("lists a key held in two places once, under its first name", () => {
    const names = listItemFiles({
      ...everyLocation,
      fileKey: "u/page-1.jpg",
      coverFileKey: "u/tweet-photo.jpg",
    }).map(({ name }) => name);
    expect(names.filter((n) => n.startsWith("original"))).toEqual([]);
    expect(names).toContain("cover.jpg");
  });
});
