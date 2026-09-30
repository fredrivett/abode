import { getAnalyticsUsername } from "./analytics-username";

/**
 * Query params that carry user content: search queries (`q`, `search`) and
 * links/text shared to `/save`.
 */
export const CONTENT_QUERY_PARAMS = ["q", "search", "url", "text", "title"];

const CONTENT_QUERY = new RegExp(
  `([?&](?:${CONTENT_QUERY_PARAMS.join("|")})=)[^&#]*`,
  "g",
);

// `/@user/items/<id>` is an item page, not a room
const NON_ROOM_SEGMENTS = new Set(["items"]);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Masks user content out of a URL or path: content query params, and the
 * room slug in `/@<username>/<slug>` when `username` is the signed-in user.
 * Only an owner can open a private room, so masking the owner's own room
 * paths covers every private-room visit while keeping visitors' public-room
 * paths intact.
 */
export function maskContentInUrl(
  url: string,
  username: string | null = getAnalyticsUsername(),
): string {
  let masked = url.includes("=")
    ? url.replace(CONTENT_QUERY, "$1<masked>")
    : url;
  if (username && masked.includes(`/@${username}/`)) {
    masked = masked.replace(
      new RegExp(`(/@${escapeRegExp(username)}/)([^/?#]+)`, "g"),
      (match, prefix: string, segment: string) =>
        NON_ROOM_SEGMENTS.has(segment) ? match : `${prefix}[room]`,
    );
  }
  return masked;
}
