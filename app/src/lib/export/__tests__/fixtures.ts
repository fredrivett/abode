import type { ExportItemRow } from "../select";

/** An export row with every optional part empty; override what a test needs */
export function itemRow(overrides: Partial<ExportItemRow> = {}): ExportItemRow {
  const at = new Date("2026-03-04T05:06:07.000Z");
  return {
    id: "0f8fad5b-d9cb-469f-a165-70867728950e",
    kind: "webpage",
    title: "A title",
    titleEditedByUser: false,
    description: null,
    sourceType: "url",
    sourceUrl: "https://example.com/post",
    captureSource: "web",
    meta: null,
    tags: [],
    userTags: [],
    notes: null,
    addedAt: at,
    createdAt: at,
    updatedAt: at,
    excludeFromPublicRooms: false,
    coverHidden: false,
    externalLinks: [],
    sharedAt: null,
    sharedHighlights: false,
    fileKey: null,
    coverFileKey: null,
    faviconFileKey: null,
    articleDetails: null,
    imageDetails: null,
    twitterDetails: null,
    instagramDetails: null,
    videoDetails: null,
    productDetails: null,
    bookDetails: null,
    noteDetails: null,
    documentPages: [],
    locations: [],
    highlights: [],
    ...overrides,
  };
}

type BookDetails = NonNullable<ExportItemRow["bookDetails"]>;

export function bookDetails(overrides: Partial<BookDetails> = {}): BookDetails {
  return {
    authors: ["Ursula K. Le Guin"],
    publisher: "Ace",
    publishedAt: new Date("1969-03-01T00:00:00.000Z"),
    isbn: "9780441478125",
    pageCount: 304,
    domain: null,
    status: null,
    startedAt: null,
    startedAtPrecision: null,
    finishedAt: null,
    finishedAtPrecision: null,
    progressValue: null,
    progressUnit: "page",
    progressUpdatedAt: null,
    rating: null,
    review: null,
    ...overrides,
  };
}

type DocumentPage = ExportItemRow["documentPages"][number];

export function documentPage(
  position: number,
  overrides: Partial<DocumentPage> = {},
): DocumentPage {
  return {
    position,
    filter: "bw",
    width: 100,
    height: 140,
    ocrText: null,
    fileKey: `u/page-${position}.jpg`,
    originalFileKey: `u/page-${position}-colour.jpg`,
    ...overrides,
  };
}
