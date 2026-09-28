import type { BookReadingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { bookDetails, itemRow } from "./__tests__/fixtures";
import {
  buildBooksCsv,
  csvField,
  GOODREADS_COLUMNS,
  toBookRow,
} from "./books-csv";
import { toExportItem } from "./serialize";

function parseRow(csv: string, index = 1): Record<string, string> {
  // Test rows avoid embedded newlines, so splitting lines is safe here
  const lines = csv.trimEnd().split("\r\n");
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  const line = lines[index];
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return Object.fromEntries(GOODREADS_COLUMNS.map((c, i) => [c, cells[i]]));
}

const bookItem = (details: Parameters<typeof bookDetails>[0], extra = {}) =>
  toExportItem(
    itemRow({
      kind: "book",
      title: "The Left Hand of Darkness",
      bookDetails: bookDetails(details),
      ...extra,
    }),
  );

describe("csvField", () => {
  it("quotes only when needed", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
    expect(csvField(null)).toBe("");
    expect(csvField(3)).toBe("3");
  });
});

describe("buildBooksCsv", () => {
  it("writes Goodreads' header even with no books", () => {
    expect(buildBooksCsv([])).toBe(`${GOODREADS_COLUMNS.join(",")}\r\n`);
  });

  it("maps a finished book to Goodreads columns", () => {
    const item = bookItem(
      {
        status: "read",
        rating: 9,
        review: 'Great, "truly"',
        finishedAt: new Date("2025-06-30T00:00:00.000Z"),
        authors: ["Ursula K. Le Guin", "Someone Else"],
      },
      { userTags: ["sci-fi"], notes: "Book club pick" },
    );
    const row = toBookRow(item);
    if (!row) throw new Error("expected a book row");
    const cells = parseRow(buildBooksCsv([row]));

    expect(cells).toMatchObject({
      Title: "The Left Hand of Darkness",
      Author: "Ursula K. Le Guin",
      "Author l-f": "",
      "Additional Authors": "Someone Else",
      ISBN: "",
      ISBN13: "9780441478125",
      "My Rating": "5",
      "Number of Pages": "304",
      "Year Published": "1969",
      "Date Read": "2025/06/30",
      "Date Added": "2026/03/04",
      "Exclusive Shelf": "read",
      Bookshelves: "read, sci-fi",
      "My Review": 'Great, "truly"',
      "Private Notes": "Book club pick",
      "Read Count": "1",
    });
  });

  it("puts each reading status on the matching shelf", () => {
    const shelf = (status: BookReadingStatus | null) => {
      const row = toBookRow(bookItem({ status }));
      if (!row) throw new Error("expected a book row");
      return parseRow(buildBooksCsv([row]))["Exclusive Shelf"];
    };
    expect(shelf("want_to_read")).toBe("to-read");
    expect(shelf("reading")).toBe("currently-reading");
    expect(shelf("dnf")).toBe("did-not-finish");
    expect(shelf(null)).toBe("to-read");
  });

  it("puts a 10-digit ISBN in the ISBN column and leaves unrated books at 0", () => {
    const row = toBookRow(bookItem({ isbn: "0-441-47812-3", rating: null }));
    if (!row) throw new Error("expected a book row");
    const cells = parseRow(buildBooksCsv([row]));
    expect(cells.ISBN).toBe("0441478123");
    expect(cells.ISBN13).toBe("");
    expect(cells["My Rating"]).toBe("0");
  });

  it("skips non-books", () => {
    expect(toBookRow(toExportItem(itemRow()))).toBeNull();
  });
});
