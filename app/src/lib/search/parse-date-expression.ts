/**
 * A hand-rolled natural-language date scanner for free-text search suggestions.
 * Deliberately narrow (no dependency): month+year, bare year, ISO dates, and a
 * few relative phrases. `now` is injected so the function stays pure/testable.
 * Anything richer ("last friday", "in 3 weeks") is intentionally out of scope —
 * we'd reach for a real parser (chrono) only if the data shows demand.
 */
import type { DateOperator } from "./types";

export type DateMatch = {
  start: number;
  end: number;
  value: string; // ISO start date (YYYY-MM-DD)
  endDate?: string; // ISO end date for ranges
  operator: DateOperator;
};

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|");

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function wholeMonth(year: number, month: number): DateMatch {
  return {
    start: 0,
    end: 0,
    value: iso(year, month, 1),
    endDate: iso(year, month, lastDayOfMonth(year, month)),
    operator: "between",
  };
}

function wholeYear(year: number): DateMatch {
  return {
    start: 0,
    end: 0,
    value: iso(year, 1, 1),
    endDate: iso(year, 12, 31),
    operator: "between",
  };
}

function singleDay(date: Date): DateMatch {
  return {
    start: 0,
    end: 0,
    value: iso(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    ),
    operator: "is",
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Ordered so earlier, more specific patterns win an overlapping span.
function buildMatchers(now: Date): Array<{
  regex: RegExp;
  build: (m: RegExpExecArray) => DateMatch | null;
}> {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return [
    // ISO date, e.g. 2026-06-15
    {
      regex: /\b(\d{4})-(\d{2})-(\d{2})\b/g,
      build: (m) => ({
        start: m.index,
        end: m.index + m[0].length,
        value: iso(+m[1], +m[2], +m[3]),
        operator: "is",
      }),
    },
    // Month + year, e.g. "june 2026"
    {
      regex: new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{4})\\b`, "gi"),
      build: (m) => ({
        ...wholeMonth(+m[2], MONTHS[m[1].toLowerCase()]),
        start: m.index,
        end: m.index + m[0].length,
      }),
    },
    // Relative phrases
    {
      regex:
        /\b(today|yesterday|this month|last month|this year|last year)\b/gi,
      build: (m) => {
        const phrase = m[0].toLowerCase();
        const span = { start: m.index, end: m.index + m[0].length };
        switch (phrase) {
          case "today":
            return { ...singleDay(now), ...span };
          case "yesterday":
            return { ...singleDay(addDays(now, -1)), ...span };
          case "this month":
            return { ...wholeMonth(year, month), ...span };
          case "last month":
            return {
              ...(month === 1
                ? wholeMonth(year - 1, 12)
                : wholeMonth(year, month - 1)),
              ...span,
            };
          case "this year":
            return { ...wholeYear(year), ...span };
          case "last year":
            return { ...wholeYear(year - 1), ...span };
          default:
            return null;
        }
      },
    },
    // Bare 4-digit year, e.g. "2026" (lowest precedence)
    {
      regex: /\b(\d{4})\b/g,
      build: (m) => ({
        ...wholeYear(+m[1]),
        start: m.index,
        end: m.index + m[0].length,
      }),
    },
  ];
}

/** Find every date expression in the query, resolving overlaps in matcher order. */
export function findDateExpressions(query: string, now: Date): DateMatch[] {
  const matches: DateMatch[] = [];

  for (const { regex, build } of buildMatchers(now)) {
    for (const m of query.matchAll(regex)) {
      const match = build(m as RegExpExecArray);
      if (!match) continue;
      const overlaps = matches.some(
        (existing) => match.start < existing.end && existing.start < match.end,
      );
      if (!overlaps) matches.push(match);
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}
