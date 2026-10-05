import type { BookReadingStatus } from "@prisma/client";
import { itemDisplayTitle } from "./markdown";
import type { ExportItem } from "./serialize";

/**
 * Goodreads' library-export columns, in order. StoryGraph, Hardcover and most
 * book apps import this layout, so emitting it (blanks included) makes abode's
 * book data portable without a bespoke importer anywhere.
 */
export const GOODREADS_COLUMNS = [
  "Book Id",
  "Title",
  "Author",
  "Author l-f",
  "Additional Authors",
  "ISBN",
  "ISBN13",
  "My Rating",
  "Average Rating",
  "Publisher",
  "Binding",
  "Number of Pages",
  "Year Published",
  "Original Publication Year",
  "Date Read",
  "Date Added",
  "Bookshelves",
  "Bookshelves with positions",
  "Exclusive Shelf",
  "My Review",
  "Spoiler",
  "Private Notes",
  "Read Count",
  "Owned Copies",
] as const;

// Goodreads' three built-in exclusive shelves, plus the "did-not-finish" shelf
// importers (e.g. StoryGraph) recognise. An untracked saved book reads as to-read.
const EXCLUSIVE_SHELF: Record<BookReadingStatus, string> = {
  want_to_read: "to-read",
  reading: "currently-reading",
  read: "read",
  dnf: "did-not-finish",
};

export type BookRow = Pick<
  ExportItem,
  "id" | "title" | "sourceUrl" | "twitter" | "addedAt" | "userTags" | "notes"
> & { book: NonNullable<ExportItem["book"]> };

/** The item as a book row, or null if it isn't a book */
export function toBookRow(item: ExportItem): BookRow | null {
  if (!item.book) return null;
  const { id, title, sourceUrl, twitter, addedAt, userTags, notes, book } =
    item;
  return { id, title, sourceUrl, twitter, addedAt, userTags, notes, book };
}

// A cell starting with one of these is a formula when the CSV is opened in a
// spreadsheet (CSV injection); a leading apostrophe makes it plain text
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Quote a CSV field when it holds a delimiter, quote or line break, and
 * neutralise text a spreadsheet would run as a formula. Numbers are left as-is.
 */
export function csvField(value: string | number | null): string {
  if (value === null) return "";
  const text =
    typeof value === "string" && FORMULA_TRIGGER.test(value)
      ? `'${value}`
      : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Goodreads writes dates as YYYY/MM/DD
const goodreadsDate = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10).replace(/-/g, "/") : null;

function isbnColumns(isbn: string | null): {
  isbn10: string | null;
  isbn13: string | null;
} {
  const digits = isbn?.replace(/[^0-9X]/gi, "") ?? "";
  if (digits.length === 13) return { isbn10: null, isbn13: digits };
  if (digits.length === 10) return { isbn10: digits, isbn13: null };
  return { isbn10: null, isbn13: null };
}

function bookCsvRow(row: BookRow): string {
  const { book } = row;
  const [author = null, ...otherAuthors] = book.authors;
  const shelf = EXCLUSIVE_SHELF[book.status ?? "want_to_read"];
  const { isbn10, isbn13 } = isbnColumns(book.isbn);
  const values: Record<
    (typeof GOODREADS_COLUMNS)[number],
    string | number | null
  > = {
    "Book Id": null,
    Title: itemDisplayTitle(row),
    Author: author,
    // Left blank: importers match on "Author", and a naive split mangles
    // multi-word surnames ("Le Guin")
    "Author l-f": null,
    "Additional Authors": otherAuthors.join(", ") || null,
    ISBN: isbn10,
    ISBN13: isbn13,
    // Goodreads ratings are whole stars; abode's /10 half-stars round up
    "My Rating": book.rating === null ? 0 : Math.ceil(book.rating / 2),
    "Average Rating": null,
    Publisher: book.publisher,
    Binding: null,
    "Number of Pages": book.pageCount,
    "Year Published": book.publishedAt?.getUTCFullYear() ?? null,
    "Original Publication Year": null,
    "Date Read": book.status === "read" ? goodreadsDate(book.finishedAt) : null,
    "Date Added": goodreadsDate(row.addedAt),
    Bookshelves: [shelf, ...row.userTags].join(", "),
    "Bookshelves with positions": null,
    "Exclusive Shelf": shelf,
    "My Review": book.review,
    Spoiler: null,
    "Private Notes": row.notes,
    "Read Count": book.status === "read" ? 1 : 0,
    "Owned Copies": 0,
  };
  return GOODREADS_COLUMNS.map((column) => csvField(values[column])).join(",");
}

/** Every saved book as a Goodreads-format CSV (header row included) */
export function buildBooksCsv(rows: BookRow[]): string {
  return `${[GOODREADS_COLUMNS.join(","), ...rows.map(bookCsvRow)].join("\r\n")}\r\n`;
}
