import type { ItemKind, Prisma } from "@prisma/client";
import db from "@/lib/db";
import { getAvailableFilters } from "@/lib/items/available-filters";
import { itemSelect, transformItem } from "@/lib/items/query";
import { isCanonicalUuid } from "@/lib/pagination";
import { listUserRooms } from "@/lib/rooms";
import type { ParsedFilters } from "@/lib/search/query-builder";
import { VALID_ITEM_KINDS } from "@/lib/search/query-builder";
import { rankedSearch } from "@/lib/search/ranked-search";
import { getAppBaseUrl } from "@/lib/url";

export const MCP_DEFAULT_LIMIT = 20;
export const MCP_MAX_LIMIT = 50;

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
  /** ISO date; only items created on or after are returned */
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
  if (params.tags?.length) {
    filters.tag = params.tags.map((value) => ({ value, negated: false }));
  }
  const kinds = validKinds(params.kinds);
  if (kinds.length) {
    filters.type = kinds.map((value) => ({ value, negated: false }));
  }
  const since = validSince(params.since);
  if (since) filters.dateAfter = since.toISOString();
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
    const ranked = await rankedSearch(
      userId,
      buildRankedFilters(params),
      query,
      {
        limit,
      },
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

  const username = await getUsername(userId);
  return { ...transformItem(row), url: itemUrl(id, username) };
}

/** A user's distinct filterable values (tags, kinds, sources, …) for discovery. */
export async function listFilters(userId: string) {
  return getAvailableFilters(userId);
}

/** A user's rooms (saved collections), newest first, each with its item count. */
export async function listRooms(userId: string) {
  return listUserRooms(userId);
}
