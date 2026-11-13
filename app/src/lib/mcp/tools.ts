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
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const DAY_MS = 24 * 60 * 60 * 1000;

// null = omitted, undefined = invalid. Requires an ISO date or timestamp, and
// rejects a calendar day that doesn't exist (2026-02-30), which `Date` would
// otherwise roll over into March
function parseDate(value: string | undefined): Date | null | undefined {
  if (!value) return null;
  const match = ISO_DATE_PREFIX.exec(value);
  const date = new Date(value);
  if (!match || Number.isNaN(date.getTime())) return undefined;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const calendar = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  const exists =
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === (month ?? 0) - 1 &&
    calendar.getUTCDate() === day;
  return exists ? date : undefined;
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
  from,
  to,
  now,
}: {
  date: Date | null;
  precision: DatePrecision | null;
  from: Date | null;
  to: Date;
  now: Date;
}): boolean {
  if (!date) return false;
  if (from && date < from) return false;
  if (!precision || precision === "day") return date <= to;
  const periodEnd = endOfPrecision(date, precision).getTime();
  const latest = Math.min(periodEnd, Math.max(now.getTime(), date.getTime()));
  return latest <= to.getTime();
}

type ActivityDate = { date: Date | null; precision: DatePrecision | null };

/**
 * Keeps the candidates with a requested activity in the period and ranks them
 * by their latest one, newest first. Callers fetch every candidate's dates
 * before cutting to their limit, so both the order and hasMore stay exact.
 */
function rankByActivity<A extends string>({
  candidates,
  requested,
  from,
  to,
  now,
}: {
  candidates: { itemId: string; dates: Record<A, ActivityDate> }[];
  requested: A[];
  from: Date | null;
  to: Date;
  now: Date;
}): { itemId: string; activity: A[] }[] {
  const matched = candidates.flatMap(({ itemId, dates }) => {
    const activity = requested.filter((a) =>
      readingDateInRange({ ...dates[a], from, to, now }),
    );
    if (activity.length === 0) return [];
    const latest = Math.max(
      ...activity.map((a) => dates[a].date?.getTime() ?? 0),
    );
    return [{ itemId, activity, latest }];
  });
  matched.sort(
    (a, b) => b.latest - a.latest || b.itemId.localeCompare(a.itemId),
  );
  return matched.map(({ itemId, activity }) => ({ itemId, activity }));
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
  const requested = [...new Set(activities)];
  // One instant for the whole call: an omitted `to` means up to now, so books
  // dated in the future never count
  const now = new Date();
  const from = range.from;
  const to = range.to ?? now;
  const inRange = rangeWhere({ from, to });
  const columns = {
    finished: { finishedAt: inRange },
    started: { startedAt: inRange },
    progressed: { progressUpdatedAt: inRange },
  } satisfies Record<BookActivity, Prisma.ItemBookDetailsWhereInput>;

  // Dates only, uncapped: the DB filter is exact for day precision but a
  // superset for month/year ones, which are re-checked here. Ranking all
  // candidates before cutting to the limit keeps both the order and hasMore exact
  const candidates = await db.itemBookDetails.findMany({
    where: {
      item: { userId },
      OR: requested.map((activity) => columns[activity]),
    },
    select: {
      itemId: true,
      startedAt: true,
      startedAtPrecision: true,
      finishedAt: true,
      finishedAtPrecision: true,
      progressUpdatedAt: true,
    },
  });

  const matched = rankByActivity({
    candidates: candidates.map((row) => ({
      itemId: row.itemId,
      dates: {
        finished: { date: row.finishedAt, precision: row.finishedAtPrecision },
        started: { date: row.startedAt, precision: row.startedAtPrecision },
        progressed: { date: row.progressUpdatedAt, precision: null },
      },
    })),
    requested,
    from,
    to,
    now,
  });
  const page = matched.slice(0, take);
  if (page.length === 0) return { books: [], hasMore: false };

  const [username, rows] = await Promise.all([
    getUsername(userId),
    db.itemBookDetails.findMany({
      where: { itemId: { in: page.map((m) => m.itemId) }, item: { userId } },
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
  const byId = new Map(rows.map((row) => [row.itemId, row]));

  return {
    books: page.flatMap(({ itemId, activity }) => {
      const row = byId.get(itemId);
      if (!row) return [];
      return [
        {
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
        },
      ];
    }),
    hasMore: matched.length > take,
  };
}

export const ARTICLE_ACTIVITIES = ["read", "progressed"] as const;
export type ArticleActivity = (typeof ARTICLE_ACTIVITIES)[number];

export type McpArticleActivity = {
  id: string;
  url: string | null;
  title: string | null;
  author: string | null;
  domain: string | null;
  sourceUrl: string | null;
  /** Which of the requested activities happened in the period */
  activity: ArticleActivity[];
  /** When the user marked it read, or null if it's unread */
  readAt: string | null;
  /** How far they've scrolled, 0..100 */
  progressPercent: number | null;
  progressUpdatedAt: string | null;
  readingTimeMinutes: number | null;
};

/**
 * The user's articles with reading activity in a period: marked read, or
 * scrolled (reading position saved). Most recent activity first.
 */
export async function getArticleActivity(
  userId: string,
  {
    range,
    activities = [...ARTICLE_ACTIVITIES],
    limit,
  }: { range: DateRange; activities?: ArticleActivity[]; limit?: number },
): Promise<{ articles: McpArticleActivity[]; hasMore: boolean }> {
  const take = clampActivityLimit(limit);
  const requested = [...new Set(activities)];
  const now = new Date();
  const from = range.from;
  const to = range.to ?? now;
  const inRange = rangeWhere({ from, to });
  const columns = {
    read: { readAt: inRange },
    progressed: { progressUpdatedAt: inRange },
  } satisfies Record<ArticleActivity, Prisma.ItemArticleDetailsWhereInput>;

  const candidates = await db.itemArticleDetails.findMany({
    where: {
      item: { userId },
      OR: requested.map((activity) => columns[activity]),
    },
    select: { itemId: true, readAt: true, progressUpdatedAt: true },
  });
  const matched = rankByActivity({
    candidates: candidates.map((row) => ({
      itemId: row.itemId,
      dates: {
        read: { date: row.readAt, precision: null },
        progressed: { date: row.progressUpdatedAt, precision: null },
      },
    })),
    requested,
    from,
    to,
    now,
  });
  const page = matched.slice(0, take);
  if (page.length === 0) return { articles: [], hasMore: false };

  const [username, rows] = await Promise.all([
    getUsername(userId),
    db.itemArticleDetails.findMany({
      where: { itemId: { in: page.map((m) => m.itemId) }, item: { userId } },
      select: {
        itemId: true,
        author: true,
        domain: true,
        readingTime: true,
        readAt: true,
        scrollProgress: true,
        progressUpdatedAt: true,
        item: { select: { title: true, sourceUrl: true } },
      },
    }),
  ]);
  const byId = new Map(rows.map((row) => [row.itemId, row]));

  return {
    articles: page.flatMap(({ itemId, activity }) => {
      const row = byId.get(itemId);
      if (!row) return [];
      return [
        {
          id: row.itemId,
          url: itemUrl(row.itemId, username),
          title: row.item.title,
          author: row.author,
          domain: row.domain,
          sourceUrl: row.item.sourceUrl,
          activity,
          readAt: row.readAt?.toISOString() ?? null,
          progressPercent:
            row.scrollProgress === null
              ? null
              : Math.round(row.scrollProgress * 100),
          progressUpdatedAt: row.progressUpdatedAt?.toISOString() ?? null,
          readingTimeMinutes: row.readingTime,
        },
      ];
    }),
    hasMore: matched.length > take,
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
