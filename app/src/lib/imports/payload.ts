import type { NormalizedBook } from "@/lib/imports/types";

/**
 * A NormalizedBook with its `Date`s flattened to ISO strings, for safe transport
 * in a Trigger.dev task payload (JSON). The route serializes; the task hydrates —
 * so date handling doesn't depend on the queue's serializer preserving `Date`.
 */
export type SerializedNormalizedBook = Omit<
  NormalizedBook,
  "publishedAt" | "addedAt" | "reading"
> & {
  publishedAt: string | null;
  addedAt: string | null;
  reading: Omit<NormalizedBook["reading"], "finishedAt"> & {
    finishedAt: string | null;
  };
};

export function serializeBook(book: NormalizedBook): SerializedNormalizedBook {
  return {
    ...book,
    publishedAt: book.publishedAt?.toISOString() ?? null,
    addedAt: book.addedAt?.toISOString() ?? null,
    reading: {
      ...book.reading,
      finishedAt: book.reading.finishedAt?.toISOString() ?? null,
    },
  };
}

export function hydrateBook(book: SerializedNormalizedBook): NormalizedBook {
  return {
    ...book,
    publishedAt: book.publishedAt ? new Date(book.publishedAt) : null,
    addedAt: book.addedAt ? new Date(book.addedAt) : null,
    reading: {
      ...book.reading,
      finishedAt: book.reading.finishedAt
        ? new Date(book.reading.finishedAt)
        : null,
    },
  };
}
