import type {
  BookProgressUnit,
  BookReadingStatus,
  DatePrecision,
  ItemKind,
  Prisma,
} from "@prisma/client";
import db from "@/lib/db";
import { getAvailableFilters } from "@/lib/items/available-filters";
import { endOfPrecision } from "@/lib/items/date-precision";
import { itemSelect, transformItem } from "@/lib/items/query";
import { isCanonicalUuid } from "@/lib/pagination";
import { listUserRooms } from "@/lib/rooms";
import type { ParsedFilters } from "@/lib/search/query-builder";
import { VALID_ITEM_KINDS } from "@/lib/search/query-builder";
import { rankedSearch } from "@/lib/search/ranked-search";
import { getAppBaseUrl } from "@/lib/url";

export const MCP_DEFAULT_LIMIT = 20;
export const MCP_MAX_LIMIT = 50;

// Activity rows (highlights, books) are small, and a period review wants all of
// them in one call rather than a page of 20
export const MCP_DEFAULT_ACTIVITY_LIMIT = 50;
export const MCP_MAX_ACTIVITY_LIMIT = 200;

// Article bodies are Markdown and occasionally book-length. ~15k tokens keeps a
// single get_item comfortably inside client output caps (Claude Code truncates
// MCP results past ~25k tokens by default)
export const MCP_MAX_ARTICLE_TOKENS = 15_000;

/**
 * Cuts `text` to roughly `budget` tokens, or returns null when it already fits.
 * A deliberately pessimistic estimate, not a real tokenizer: ~4 ASCII chars per
 * token (English, Markdown) but a whole token for any other character, since
 * CJK, emoji and symbols often cost a token or more each. Never splits a
 * surrogate pair.
 */
export function truncateToTokenBudget(
  text: string,
  budget: number,
): string | null {
  let tokens = 0;
  let end = 0;
  for (const char of text) {
    tokens += (char.codePointAt(0) ?? 0) < 128 ? 0.25 : 1;
    if (tokens > budget) return text.slice(0, end);
    end += char.length;
  }
  return null;
}

/** Compact, token-efficient item shape for list/search results. */
export type McpItem = {
  id: string;
  /** Deep link to the item in abode, or null if the user has no username set */
  url: string | null;
  title: string | null;
  description: string | null;
  kind: ItemKind | null;
  tags: string[];
  sourceUrl: string | null;
  createdAt: string;
  /** Highlighted snippet when the item matched via search text */
  matchSnippet?: string;
};

export type GetItemsParams = {
  /** Free text — when present, results are relevance-ranked; otherwise newest-first */
  query?: string;
  tags?: string[];
  kinds?: string[];
  /**
   * ISO date, browse mode only (no `query`) — returns items created on or after.
   * Ignored when `query` is set; use each result's `createdAt` instead.
   */
  since?: string;
  limit?: number;
};

const compactItemSelect = {
  id: true,
  kind: true,
  title: true,
  description: true,
  tags: true,
  userTags: true,
  sourceUrl: true,
  createdAt: true,
} satisfies Prisma.ItemSelect;

type CompactItemRow = Prisma.ItemGetPayload<{
  select: typeof compactItemSelect;
}>;

function clampLimit(limit: number | undefined): number {
  if (!limit || limit < 1) return MCP_DEFAULT_LIMIT;
  return Math.min(limit, MCP_MAX_LIMIT);
}

// Drop anything that isn't a real ItemKind so it can't reach an enum-typed query
function validKinds(kinds: string[] | undefined): ItemKind[] {
  if (!kinds?.length) return [];
  const allowed = VALID_ITEM_KINDS as readonly string[];
  return kinds.filter((k): k is ItemKind => allowed.includes(k));
}

// Ignore an unparseable date rather than letting it throw downstream
function validSince(since: string | undefined): Date | null {
  if (!since) return null;
  const date = new Date(since);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getUsername(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return user?.username ?? null;
}

function itemUrl(id: string, username: string | null): string | null {
  return username ? `${getAppBaseUrl()}/@${username}/items/${id}` : null;
}

function toMcpItem(
  row: CompactItemRow,
  username: string | null,
  matchSnippet?: string | null,
): McpItem {
  return {
    id: row.id,
    url: itemUrl(row.id, username),
    title: row.title,
    description: row.description,
    kind: row.kind,
    tags: [...new Set([...row.tags, ...row.userTags])],
    sourceUrl: row.sourceUrl,
    createdAt: row.createdAt.toISOString(),
    ...(matchSnippet ? { matchSnippet } : {}),
  };
}

function buildRankedFilters(params: GetItemsParams): ParsedFilters {
  const filters: ParsedFilters = {};
  // One orGroup per array so multiple values OR together (any-of), matching
  // recent mode's `in`/`hasSome`; without it the search builders AND them.
  if (params.tags?.length) {
    filters.tag = params.tags.map((value) => ({
      value,
      negated: false,
      orGroup: 0,
    }));
  }
  const kinds = validKinds(params.kinds);
  if (kinds.length) {
    filters.type = kinds.map((value) => ({
      value,
      negated: false,
      orGroup: 0,
    }));
  }
  // `since` is intentionally NOT applied here: the ranked date predicate filters
  // on capture-date, not created-at. We apply created-at at hydration instead.
  return filters;
}

function buildRecentWhere(
  userId: string,
  params: GetItemsParams,
): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = { userId };
  if (params.tags?.length) {
    where.OR = [
      { tags: { hasSome: params.tags } },
      { userTags: { hasSome: params.tags } },
    ];
  }
  const kinds = validKinds(params.kinds);
  if (kinds.length) where.kind = { in: kinds };
  const since = validSince(params.since);
  if (since) where.createdAt = { gte: since };
  return where;
}

/**
 * The workhorse read tool. With a `query`, returns relevance-ranked items
 * (full-text + vector + OCR); without one, returns the newest items. `tags`,
 * `kinds`, and `since` narrow either mode. All results are scoped to the user.
 */
export async function getItems(
  userId: string,
  params: GetItemsParams,
): Promise<McpItem[]> {
  const limit = clampLimit(params.limit);
  const username = await getUsername(userId);
  const query = params.query?.trim();

  if (query) {
    // `since` is not applied here: ranked search caps candidates before any
    // created-at filter could run, so date-narrowing a query would silently drop
    // relevant matches beyond the cap. Date filtering is browse-mode only; each
    // result still carries createdAt for the caller to reason over.
    const ranked = await rankedSearch(
      userId,
      buildRankedFilters(params),
      query,
      { limit },
    );
    if (ranked.length === 0) return [];

    const rows = await db.item.findMany({
      where: { id: { in: ranked.map((r) => r.id) }, userId },
      select: compactItemSelect,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    // Preserve RRF order and carry the match snippet through
    return ranked.flatMap((result) => {
      const row = byId.get(result.id);
      return row ? [toMcpItem(row, username, result.ocrSnippet)] : [];
    });
  }

  const rows = await db.item.findMany({
    where: buildRecentWhere(userId, params),
    select: compactItemSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return rows.map((row) => toMcpItem(row, username));
}

/**
 * Full detail for a single owned item, or null if it doesn't exist / isn't the
 * user's. Includes the same rich per-kind detail the app uses, plus a deep link.
 */
export async function getItem(userId: string, id: string) {
  if (!isCanonicalUuid(id)) return null;

  const row = await db.item.findUnique({
    where: { id, userId },
    select: itemSelect,
  });
  if (!row) return null;

  const [username, highlightRows] = await Promise.all([
    getUsername(userId),
    db.articleHighlight.findMany({
      where: { itemId: id, userId },
      orderBy: { startOffset: "asc" },
      select: highlightSelect,
    }),
  ]);
  const item = {
    ...transformItem(row),
    highlights: highlightRows.map(toHighlightFields),
  };
  const article = item.articleDetails;
  const truncated = article?.content
    ? truncateToTokenBudget(article.content, MCP_MAX_ARTICLE_TOKENS)
    : null;
  if (article?.content && truncated !== null) {
    return {
      ...item,
      articleDetails: {
        // Flags first, so they survive even if a client cuts the result short:
        // they tell the assistant the text stops early and how long it was
        contentTruncated: true,
        contentLength: article.content.length,
        ...article,
        content: truncated,
      },
      url: itemUrl(id, username),
    };
  }
  return { ...item, url: itemUrl(id, username) };
}

/** An activity tool's period, as resolved by {@link resolveDateRange}; null = unbounded */
export type DateRange = { from: Date | null; to: Date | null };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string | undefined): Date | null | undefined {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Resolves an activity tool's `from`/`to` into instants, or null when either
 * is unparseable or `from` is after `to`. Both ends are inclusive and
 * optional: a date-only `to` (2026-11-30) covers that whole UTC day.
 */
export function resolveDateRange(params: {
  from?: string;
  to?: string;
}): DateRange | null {
  const from = parseDate(params.from);
  let to = parseDate(params.to);
  if (from === undefined || to === undefined) return null;
  if (to && params.to && DATE_ONLY.test(params.to)) {
    to = new Date(to.getTime() + DAY_MS - 1);
  }
  if (from && to && from > to) return null;
  return { from, to };
}

function rangeWhere(range: DateRange): Prisma.DateTimeFilter {
  return {
    ...(range.from && { gte: range.from }),
    ...(range.to && { lte: range.to }),
  };
}

function clampActivityLimit(limit: number | undefined): number {
  if (!limit || limit < 1) return MCP_DEFAULT_ACTIVITY_LIMIT;
  return Math.min(limit, MCP_MAX_ACTIVITY_LIMIT);
}

const highlightSelect = {
  id: true,
  text: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArticleHighlightSelect;

function toHighlightFields(
  row: Prisma.ArticleHighlightGetPayload<{ select: typeof highlightSelect }>,
) {
  return {
    id: row.id,
    text: row.text,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type McpHighlight = ReturnType<typeof toHighlightFields> & {
  item: {
    id: string;
    url: string | null;
    title: string | null;
    kind: ItemKind | null;
    sourceUrl: string | null;
  };
};

/**
 * The user's highlights made (created) in a period, across all their items,
 * newest first, each with the item it's on. `hasMore` means the limit cut the
 * period short.
 */
export async function getHighlights(
  userId: string,
  { range, limit }: { range: DateRange; limit?: number },
): Promise<{ highlights: McpHighlight[]; hasMore: boolean }> {
  const take = clampActivityLimit(limit);
  const [username, rows] = await Promise.all([
    getUsername(userId),
    db.articleHighlight.findMany({
      where: { userId, item: { userId }, createdAt: rangeWhere(range) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: {
        ...highlightSelect,
        item: {
          select: { id: true, title: true, kind: true, sourceUrl: true },
        },
      },
    }),
  ]);
  return {
    highlights: rows.slice(0, take).map((row) => ({
      ...toHighlightFields(row),
      item: { ...row.item, url: itemUrl(row.item.id, username) },
    })),
    hasMore: rows.length > take,
  };
}

export const BOOK_ACTIVITIES = ["finished", "started", "progressed"] as const;
export type BookActivity = (typeof BOOK_ACTIVITIES)[number];

// Upper bound on candidate books per call. The DB pre-filter is exact for
// day-precision dates; coarse ones are re-checked in memory, so the rows have
// to come back first. Reaching it reports hasMore rather than dropping silently.
const BOOK_CANDIDATE_CAP = 1000;

/**
 * Whether a started/finished date lies within the range. A month- or
 * year-precision date only says "some time in that month/year", so it matches
 * only when the range covers the whole period — clipped to now, since reading
 * can't happen in the future (so "this month so far" still matches a date
 * known only as this month).
 */
function readingDateInRange({
  date,
  precision,
  range,
}: {
  date: Date | null;
  precision: DatePrecision | null;
  range: DateRange;
}): boolean {
  if (!date) return false;
  if (range.from && date < range.from) return false;
  if (!range.to) return true;
  if (!precision || precision === "day") return date <= range.to;
  const periodEnd = endOfPrecision(date, precision).getTime();
  const latest = Math.min(periodEnd, Math.max(Date.now(), date.getTime()));
  return latest <= range.to.getTime();
}

export type McpBookActivity = {
  id: string;
  url: string | null;
  title: string | null;
  authors: string[];
  status: BookReadingStatus | null;
  /** Which of the requested activities happened in the period */
  activity: BookActivity[];
  startedAt: string | null;
  startedAtPrecision: DatePrecision | null;
  finishedAt: string | null;
  finishedAtPrecision: DatePrecision | null;
  progressValue: number | null;
  progressUnit: BookProgressUnit;
  pageCount: number | null;
  progressUpdatedAt: string | null;
  /** Out of 5, in half stars (stored /10) */
  ratingStars: number | null;
  review: string | null;
};

/**
 * The user's books with reading activity in a period: finished (incl. did
 * not finish — `status` tells which), started, or progress updated. Most
 * recent activity first.
 */
export async function getBookActivity(
  userId: string,
  {
    range,
    activities = [...BOOK_ACTIVITIES],
    limit,
  }: { range: DateRange; activities?: BookActivity[]; limit?: number },
): Promise<{ books: McpBookActivity[]; hasMore: boolean }> {
  const take = clampActivityLimit(limit);
  // `not: null` keeps an unbounded range from matching untracked books
  const inRange = { ...rangeWhere(range), not: null };
  const columns = {
    finished: { finishedAt: inRange },
    started: { startedAt: inRange },
    progressed: { progressUpdatedAt: inRange },
  } satisfies Record<BookActivity, Prisma.ItemBookDetailsWhereInput>;

  const [username, rows] = await Promise.all([
    getUsername(userId),
    db.itemBookDetails.findMany({
      where: {
        item: { userId },
        OR: activities.map((activity) => columns[activity]),
      },
      orderBy: { updatedAt: "desc" },
      take: BOOK_CANDIDATE_CAP,
      select: {
        itemId: true,
        authors: true,
        pageCount: true,
        status: true,
        startedAt: true,
        startedAtPrecision: true,
        finishedAt: true,
        finishedAtPrecision: true,
        progressValue: true,
        progressUnit: true,
        progressUpdatedAt: true,
        rating: true,
        review: true,
        item: { select: { title: true } },
      },
    }),
  ]);

  const matched = rows.flatMap((row) => {
    const dates: Record<BookActivity, Date | null> = {
      finished: row.finishedAt,
      started: row.startedAt,
      progressed: row.progressUpdatedAt,
    };
    const precisions: Record<BookActivity, DatePrecision | null> = {
      finished: row.finishedAtPrecision,
      started: row.startedAtPrecision,
      progressed: null,
    };
    const activity = activities.filter((a) =>
      readingDateInRange({ date: dates[a], precision: precisions[a], range }),
    );
    if (activity.length === 0) return [];
    const latest = Math.max(...activity.map((a) => dates[a]?.getTime() ?? 0));
    return [{ row, activity, latest }];
  });
  matched.sort(
    (a, b) => b.latest - a.latest || b.row.itemId.localeCompare(a.row.itemId),
  );

  return {
    books: matched.slice(0, take).map(({ row, activity }) => ({
      id: row.itemId,
      url: itemUrl(row.itemId, username),
      title: row.item.title,
      authors: row.authors,
      status: row.status,
      activity,
      startedAt: row.startedAt?.toISOString() ?? null,
      startedAtPrecision: row.startedAt
        ? (row.startedAtPrecision ?? "day")
        : null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      finishedAtPrecision: row.finishedAt
        ? (row.finishedAtPrecision ?? "day")
        : null,
      progressValue: row.progressValue,
      progressUnit: row.progressUnit,
      pageCount: row.pageCount,
      progressUpdatedAt: row.progressUpdatedAt?.toISOString() ?? null,
      ratingStars: row.rating === null ? null : row.rating / 2,
      review: row.review,
    })),
    hasMore: matched.length > take || rows.length === BOOK_CANDIDATE_CAP,
  };
}

/** A user's distinct filterable values (tags, kinds, sources, …) for discovery. */
export async function listFilters(userId: string) {
  return getAvailableFilters(userId);
}

/** A user's rooms (saved collections), newest first, each with its item count. */
export async function listRooms(userId: string) {
  return listUserRooms(userId);
}
