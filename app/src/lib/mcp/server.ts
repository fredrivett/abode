import type { AuthInfo, CallToolResult } from "@modelcontextprotocol/server";
import { McpServer } from "@modelcontextprotocol/server";
import { ItemKind } from "@prisma/client";
import { z } from "zod";
import type { AuthenticatedRequest } from "@/lib/auth/authenticate-request";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getItem,
  getItems,
  listFilters,
  listRooms,
  MCP_MAX_LIMIT,
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

Use get_items to search (pass a query) or to browse recent saves (omit it). Use get_item for an item's full detail. Use list_filters to discover the tags and kinds the user actually has, and list_rooms for their rooms. Everything is read-only.`;

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

/** Builds the per-request MCP server for one caller: four read-only tools over their library */
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
        "Full detail for one of the user's items (by id from get_items): article text, product details, notes, highlights and more depending on its kind.",
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
