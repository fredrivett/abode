/**
 * Collapse a between-range that spans exactly whole months or years into a
 * simpler label:
 *   2026-06-01 … 2026-06-30 → "June 2026"
 *   2026-01-01 … 2026-12-31 → "2026"
 *   2025-01-01 … 2026-12-31 → "2025 – 2026"
 *   2026-06-01 … 2026-08-31 → "June – August 2026"
 *   2025-06-01 … 2026-02-28 → "June 2025 – February 2026"
 * Returns null when the range doesn't line up to whole month/year boundaries,
 * so the caller can fall back to the plain "start – end" form.
 */
export function collapseDateRange(
  startStr: string,
  endStr: string,
): string | null {
  const start = parseIsoParts(startStr);
  const end = parseIsoParts(endStr);
  if (!start || !end) return null;

  // must start on the 1st and end on the last day of its month
  if (start.day !== 1 || end.day !== lastDayOfMonth(end.year, end.month)) {
    return null;
  }

  const spansWholeYears = start.month === 1 && end.month === 12;
  if (spansWholeYears) {
    return start.year === end.year
      ? `${start.year}`
      : `${start.year} – ${end.year}`;
  }

  if (start.year === end.year && start.month === end.month) {
    return monthYear(start.year, start.month);
  }
  if (start.year === end.year) {
    return `${monthName(start.month)} – ${monthName(end.month)} ${end.year}`;
  }
  return `${monthYear(start.year, start.month)} – ${monthYear(end.year, end.month)}`;
}

type IsoParts = { year: number; month: number; day: number };

function parseIsoParts(value: string): IsoParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { year: +match[1], month: +match[2], day: +match[3] };
}

function lastDayOfMonth(year: number, month: number): number {
  // Date.UTC(year, month, 0) rolls back to the last day of `month` (1-based)
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthName(month: number): string {
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
}

function monthYear(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
