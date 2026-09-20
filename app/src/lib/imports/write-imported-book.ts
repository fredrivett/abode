import type { SupabaseClient } from "@supabase/supabase-js";
import db from "@/lib/db";
import { downloadAndStoreCover } from "@/lib/imports/store-cover";
import type { ImportSource, NormalizedBook } from "@/lib/imports/types";
import { startOfPrecision } from "@/lib/items/date-precision";

export type WriteImportedBookResult =
  | { status: "created"; itemId: string }
  | { status: "skipped" };

/**
 * Persist one NormalizedBook as a `book` Item (+ `ItemBookDetails` reading
 * state), downloading and storing its cover with a local blur. Idempotent by
 * ISBN per user: a book whose ISBN the user already has is skipped.
 *
 * The item is created `pending` so the caller can hand it to
 * `enqueueBackgroundProcessing` for enrichment (which claims `pending`→
 * `processing` or defers). All metadata is written up front, so the book is
 * viewable immediately regardless of enrichment state. Cover download happens
 * outside the DB transaction (no network inside a tx). Follows the counting
 * transaction from `POST /api/v1/items` (increments `itemCount`/`storageUsedBytes`).
 */
export async function writeImportedBook({
  userId,
  book,
  source,
  supabase,
}: {
  userId: string;
  book: NormalizedBook;
  source: ImportSource;
  supabase: SupabaseClient;
}): Promise<WriteImportedBookResult> {
  // Dedupe by ISBN (per user). Books without an ISBN always import.
  if (book.isbn) {
    const existing = await db.item.findFirst({
      where: { userId, kind: "book", bookDetails: { isbn: book.isbn } },
      select: { id: true },
    });
    if (existing) return { status: "skipped" };
  }

  const cover = book.coverUrl
    ? await downloadAndStoreCover({ coverUrl: book.coverUrl, userId, supabase })
    : null;

  const finishedAt =
    book.reading.finishedAt && book.reading.finishedAtPrecision
      ? startOfPrecision(
          book.reading.finishedAt,
          book.reading.finishedAtPrecision,
        )
      : book.reading.finishedAt;

  try {
    const itemId = await db.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          userId,
          kind: "book",
          title: book.title,
          description: book.description,
          coverFileKey: cover?.fileKey ?? null,
          captureSource: "web",
          processingStatus: "pending",
          // Back-date to the source's added date so imported books sit at their
          // real place in the timeline (createdAt drives the dashboard sort). No
          // account-scoped logic reads item.createdAt, so this is display/sort
          // only. Falls back to now() when the source didn't provide a date.
          ...(book.addedAt && { createdAt: book.addedAt }),
          meta: {
            originalName: book.title,
            importSource: source,
            importSourceId: book.sourceId,
            ...(cover && { coverSize: cover.size }),
            ...(cover &&
              cover.width > 0 &&
              cover.height > 0 && {
                coverWidth: cover.width,
                coverHeight: cover.height,
              }),
          },
        },
        select: { id: true },
      });

      await tx.itemBookDetails.create({
        data: {
          itemId: item.id,
          authors: book.authors,
          publisher: book.publisher,
          publishedAt: book.publishedAt,
          isbn: book.isbn,
          pageCount: book.pageCount,
          status: book.reading.status,
          rating: book.reading.rating,
          review: book.reading.review,
          finishedAt,
          finishedAtPrecision: book.reading.finishedAtPrecision,
        },
      });

      if (cover?.blurDataUrl) {
        await tx.itemImageDetails.create({
          data: { itemId: item.id, blurDataUrl: cover.blurDataUrl },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          itemCount: { increment: 1 },
          ...(cover &&
            cover.size > 0 && {
              storageUsedBytes: { increment: cover.size },
            }),
        },
      });

      return item.id;
    });

    return { status: "created", itemId };
  } catch (error) {
    // The cover was uploaded before the transaction; if the write fails, remove
    // the now-orphaned blob (best-effort) before rethrowing so it isn't leaked.
    if (cover) {
      await supabase.storage
        .from("items")
        .remove([cover.fileKey])
        .catch(() => {});
    }
    throw error;
  }
}
