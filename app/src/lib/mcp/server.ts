import type { AuthInfo, CallToolResult } from "@modelcontextprotocol/server";
import { McpServer } from "@modelcontextprotocol/server";
import { ItemKind } from "@prisma/client";
import { z } from "zod";
import type { AuthenticatedRequest } from "@/lib/auth/authenticate-request";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  ARTICLE_ACTIVITIES,
  BOOK_ACTIVITIES,
  getArticleActivity,
  getBookActivity,
  getHighlights,
  getItem,
  getItems,
  listFilters,
  listRooms,
  MCP_DEFAULT_ACTIVITY_LIMIT,
  MCP_MAX_ACTIVITY_LIMIT,
  MCP_MAX_LIMIT,
  resolveDateRange,
} from "./tools";

const log = createLogger("lib/mcp/server");

/** Who an MCP request is for, carried from the route's auth check to the tools */
export type McpCaller = {
  userId: string;
  authMethod: AuthenticatedRequest["method"];
  /** The personal access token used, or null for a web/extension session */
  tokenId: string | null;
};

const SERVER_INFO = { name: "abode", version: "1.0.0" };

const INSTRUCTIONS = `abode is the user's personal library of things they've saved: links, articles, images, videos, tweets, products, books, notes and scanned documents. Items can be grouped into rooms (collections).

Use get_items to search (pass a query) or to browse recent saves (omit it). Use get_item for an item's full detail. Use list_filters to discover the tags and kinds the user actually has, and list_rooms for their rooms.

For what the user has been reading over a period (e.g. a weekly review), use get_highlights for the passages they highlighted, get_book_activity for books they finished, started or made progress on, and get_article_activity for articles they read or scrolled through. All three take a from/to date range, so there's no need to fetch items one by one. get_items' since filters on when an item was saved, not when it was read.

Everything is read-only.`;

/**
 * Packs the authenticated caller into the SDK's AuthInfo, which the handler
 * passes through untouched to the per-request server factory.
 */
export function toAuthInfo(auth: AuthenticatedRequest): AuthInfo {
  const tokenId = auth.method === "pat" ? auth.tokenId : null;
  const caller: McpCaller = {
    userId: auth.user.id,
    authMethod: auth.method,
    tokenId,
  };
  return {
    // The raw credential isn't needed downstream, so it's never carried here
    token: "",
    clientId: tokenId ?? auth.method,
    scopes: ["read"],
    extra: { caller },
  };
}

function isMcpCaller(value: unknown): value is McpCaller {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    typeof value.userId === "string" &&
    "authMethod" in value &&
    (value.authMethod === "cookie" ||
      value.authMethod === "bearer" ||
      value.authMethod === "pat") &&
    "tokenId" in value &&
    (value.tokenId === null || typeof value.tokenId === "string")
  );
}

export function callerFromAuthInfo(
  authInfo: AuthInfo | undefined,
): McpCaller | null {
  const caller = authInfo?.extra?.caller;
  return isMcpCaller(caller) ? caller : null;
}

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/**
 * Runs a tool for the caller: records usage, and turns an unexpected failure
 * into a tool error (reported, never leaked) instead of a transport error.
 */
async function runTool(
  caller: McpCaller,
  tool: string,
  fn: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  let result: CallToolResult;
  try {
    result = await fn();
  } catch (error) {
    log.error({ error, userId: caller.userId, tool }, "MCP tool failed");
    captureServerException(error, caller.userId, { route: "mcp", tool });
    result = errorResult("Something went wrong running this tool.");
  }

  getPostHogClient()?.capture({
    distinctId: caller.userId,
    event: "mcp_tool_called",
    properties: {
      tool,
      success: result.isError !== true,
      auth_method: caller.authMethod,
      token_id: caller.tokenId,
    },
  });
  return result;
}

const getItemsInput = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .optional()
    .describe(
      "Free-text search. When set, results are ranked by relevance (full text, meaning and text found in images). Omit to browse newest first.",
    ),
  tags: z
    .array(z.string().min(1).max(100))
    .max(20)
    .optional()
    .describe(
      "Only items with any of these tags (see list_filters for the user's tags)",
    ),
  kinds: z
    .array(z.enum(ItemKind))
    .max(10)
    .optional()
    .describe("Only items of any of these kinds"),
  since: z
    .string()
    .optional()
    .describe(
      "ISO date; browse mode only (ignored with a query). Returns items saved on or after it.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MCP_MAX_LIMIT)
    .optional()
    .describe(`How many items to return (default 20, max ${MCP_MAX_LIMIT})`),
});

const dateRangeInput = {
  from: z
    .string()
    .optional()
    .describe(
      "Start of the period, inclusive: an ISO date (2026-11-04, a UTC day) or an ISO timestamp with offset. Omit for no lower bound.",
    ),
  to: z
    .string()
    .optional()
    .describe(
      "End of the period, inclusive: a date-only value covers that whole UTC day (2026-11-30 = through the end of 30 Nov). Omit for up to now.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MCP_MAX_ACTIVITY_LIMIT)
    .optional()
    .describe(
      `How many to return (default ${MCP_DEFAULT_ACTIVITY_LIMIT}, max ${MCP_MAX_ACTIVITY_LIMIT}). hasMore: true means there are more in the period: raise the limit or narrow the range.`,
    ),
};

const INVALID_RANGE =
  "Invalid date range: from and to must be ISO dates or timestamps, with from not after to.";

/** Builds the per-request MCP server for one caller: read-only tools over their library */
export function buildMcpServer(caller: McpCaller): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  const readOnly = { readOnlyHint: true, openWorldHint: false };

  server.registerTool(
    "get_items",
    {
      title: "Search or browse saved items",
      description:
        "Search the user's saved items with a query, or browse their most recent saves without one. Narrow with tags, kinds and (browse only) a since date. Returns compact items with a link back to abode.",
      inputSchema: getItemsInput,
      annotations: readOnly,
    },
    (params) =>
      runTool(caller, "get_items", async () => {
        // A query runs ranked search (incl. a paid embedding), so it shares the
        // search route's per-user limit
        if (params.query) {
          const limit = checkRateLimit(caller.userId, "search");
          if (!limit.allowed) {
            return errorResult(
              `Search rate limit reached. Try again in ${limit.retryAfter ?? 60} seconds.`,
            );
          }
        }
        return jsonResult(await getItems(caller.userId, params));
      }),
  );

  server.registerTool(
    "get_item",
    {
      title: "Get one saved item",
      description:
        "Full detail for one of the user's items (by id from get_items): article text, product details, book reading state, notes, highlights and more depending on its kind.",
      inputSchema: z.object({
        id: z.string().describe("The item's id, as returned by get_items"),
      }),
      annotations: readOnly,
    },
    ({ id }) =>
      runTool(caller, "get_item", async () => {
        const item = await getItem(caller.userId, id);
        return item ? jsonResult(item) : errorResult("Item not found.");
      }),
  );

  server.registerTool(
    "get_highlights",
    {
      title: "Highlights made in a period",
      description:
        "Passages the user highlighted in a period, across all their items, newest first: each with its text, the user's note on it, when it was made, and the item it's from (title, kind, link). Filters on when the highlight was made, not when the item was saved.",
      inputSchema: z.object(dateRangeInput),
      annotations: readOnly,
    },
    ({ limit, ...dates }) =>
      runTool(caller, "get_highlights", async () => {
        const range = resolveDateRange(dates);
        if (!range) return errorResult(INVALID_RANGE);
        return jsonResult(await getHighlights(caller.userId, { range, limit }));
      }),
  );

  server.registerTool(
    "get_book_activity",
    {
      title: "Books read in a period",
      description:
        "Books the user finished, started or made progress on in a period, most recent activity first, with reading status, start/finish dates, progress, rating (ratingStars, out of 5) and review. Each book's activity lists which of these happened in the period. finished covers both read and did-not-finish (status dnf). A start/finish date known only to the month or year (its precision) matches only when the range covers that whole month or year (up to today), so it never counts toward a shorter period it may not fall in. progressed means the latest progress update was in the period; earlier updates aren't kept.",
      inputSchema: z.object({
        ...dateRangeInput,
        activity: z
          .array(z.enum(BOOK_ACTIVITIES))
          .min(1)
          .max(BOOK_ACTIVITIES.length)
          .optional()
          .describe("Only these kinds of activity (default: all three)"),
      }),
      annotations: readOnly,
    },
    ({ limit, activity, ...dates }) =>
      runTool(caller, "get_book_activity", async () => {
        const range = resolveDateRange(dates);
        if (!range) return errorResult(INVALID_RANGE);
        return jsonResult(
          await getBookActivity(caller.userId, {
            range,
            activities: activity,
            limit,
          }),
        );
      }),
  );

  server.registerTool(
    "get_article_activity",
    {
      title: "Articles read in a period",
      description:
        "Articles the user marked as read or made progress on (scrolled through, saving their place) in a period, most recent activity first, with title, author, link, when they were marked read, how far they've scrolled (progressPercent) and reading time. Each article's activity lists which of these happened in the period. Read is a deliberate mark by the user; progressed only means they opened and scrolled it, not that they finished. progressed means the latest scroll was in the period; earlier ones aren't kept.",
      inputSchema: z.object({
        ...dateRangeInput,
        activity: z
          .array(z.enum(ARTICLE_ACTIVITIES))
          .min(1)
          .max(ARTICLE_ACTIVITIES.length)
          .optional()
          .describe("Only these kinds of activity (default: both)"),
      }),
      annotations: readOnly,
    },
    ({ limit, activity, ...dates }) =>
      runTool(caller, "get_article_activity", async () => {
        const range = resolveDateRange(dates);
        if (!range) return errorResult(INVALID_RANGE);
        return jsonResult(
          await getArticleActivity(caller.userId, {
            range,
            activities: activity,
            limit,
          }),
        );
      }),
  );

  server.registerTool(
    "list_filters",
    {
      title: "List tags and kinds",
      description:
        "The distinct tags, kinds, sources and other filter values in the user's library, to discover what to pass to get_items.",
      annotations: readOnly,
    },
    () =>
      runTool(caller, "list_filters", async () =>
        jsonResult(await listFilters(caller.userId)),
      ),
  );

  server.registerTool(
    "list_rooms",
    {
      title: "List rooms",
      description:
        "The user's rooms (collections of items), newest first, with each room's item count.",
      annotations: readOnly,
    },
    () =>
      runTool(caller, "list_rooms", async () =>
        jsonResult(await listRooms(caller.userId)),
      ),
  );

  return server;
}
