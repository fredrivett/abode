import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@trigger.dev/sdk";
import { extractMetaContent } from "../src/lib/html-metadata";
import { safeFetch } from "../src/lib/http/safe-fetch";
import type { InstagramDetails } from "../src/lib/types/item";
import { persistInstagramItem } from "./persist-instagram-item";

// Instagram serves full OpenGraph tags only to whitelisted link-preview
// user-agents; a normal browser UA gets an empty shell.
const FB_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

type HandleInstagramUrlPayload = {
  itemId: string;
  userId: string;
  url: string;
  postId: string;
  mediaType: InstagramDetails["mediaType"];
};

type HandleInstagramUrlResult = {
  success: true;
  itemId: string;
  kind: "instagram";
  instagramDetails: InstagramDetails;
};

export type InstagramOg = {
  authorUsername: string | null;
  authorName: string | null;
  caption: string | null;
  coverImageUrl: string | null;
  likeCount: number | null;
  commentCount: number | null;
  postedAt: string | null;
};

function parseCount(value: string): number | null {
  const n = Number.parseInt(value.replace(/,/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

/** The quoted caption after "… on Instagram:" in the og:title. */
function extractCaption(ogTitle: string | null): string | null {
  const afterMarker = ogTitle?.match(/on Instagram:\s*(.*)$/i)?.[1];
  if (!afterMarker) return null;
  // Instagram wraps the caption in straight or smart double-quotes.
  return afterMarker.replace(/^["“]|["”]$/g, "").trim() || null;
}

/** Best-effort post date from the "… on July 24, 2026:" fragment in og:description. */
function extractPostedAt(ogDescription: string | null): string | null {
  const match = ogDescription?.match(/on\s+([A-Z][a-z]+ \d{1,2}, \d{4})/);
  if (!match) return null;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Parse the fields we can get from an Instagram post's OpenGraph tags. This is
 * all a server-side (URL-paste) capture can reach — a single cover image, the
 * author, and the caption/counts — hence the resulting item is `basic` capture.
 * Exported for testing.
 */
export function parseInstagramOg(
  html: string,
  fallbackUrl: string,
): InstagramOg {
  const ogTitle = extractMetaContent(html, "og:title");
  const ogDescription = extractMetaContent(html, "og:description");
  const ogImage = extractMetaContent(html, "og:image");
  const ogUrl = extractMetaContent(html, "og:url") ?? fallbackUrl;

  // Username from the canonical og:url (…/<username>/p/<code>/), else the
  // "- <username> on <date>" fragment in og:description.
  const authorUsername =
    ogUrl.match(/instagram\.com\/([^/]+)\/(?:p|reels?|tv)\//i)?.[1] ??
    ogDescription?.match(/-\s*([A-Za-z0-9_.]+)\s+on\b/)?.[1] ??
    null;

  const authorName =
    ogTitle?.match(/^(.*?)\s+on Instagram/i)?.[1]?.trim() || null;

  const counts = ogDescription?.match(
    /([\d,]+)\s+likes?,\s+([\d,]+)\s+comments?/i,
  );

  return {
    authorUsername,
    authorName,
    caption: extractCaption(ogTitle),
    coverImageUrl: ogImage,
    likeCount: counts ? parseCount(counts[1]) : null,
    commentCount: counts ? parseCount(counts[2]) : null,
    postedAt: extractPostedAt(ogDescription),
  };
}

/**
 * Handle an Instagram post URL: fetch its OpenGraph metadata and store it as a
 * `basic`-capture instagram item (a single re-hosted cover). The browser
 * extension can later enrich it to the full carousel (`full` capture).
 */
export async function handleInstagramUrl(
  payload: HandleInstagramUrlPayload,
  supabase: SupabaseClient,
): Promise<HandleInstagramUrlResult> {
  const { itemId, userId, url, postId, mediaType } = payload;

  logger.log("Fetching Instagram post", { itemId, postId, url });

  const response = await safeFetch(url, { headers: { "User-Agent": FB_UA } });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Instagram post ${postId}: ${response.status}`,
    );
  }
  const og = parseInstagramOg(await response.text(), url);

  // A private, deleted, or login-gated post returns an empty shell — no author
  // and no image. Fail so the run surfaces rather than writing a hollow item.
  if (!og.authorUsername && !og.coverImageUrl) {
    throw new Error(
      `Instagram post ${postId} returned no usable OpenGraph data`,
    );
  }

  const details: InstagramDetails = {
    postId,
    mediaType,
    authorName: og.authorName,
    authorUsername: og.authorUsername ?? "unknown",
    caption: og.caption,
    postedAt: og.postedAt,
    media: og.coverImageUrl ? [{ type: "photo", url: og.coverImageUrl }] : null,
    likeCount: og.likeCount,
    commentCount: og.commentCount,
    coverMediaIndex: og.coverImageUrl ? 0 : null,
  };

  const instagramDetails = await persistInstagramItem(supabase, {
    itemId,
    userId,
    url,
    captureLevel: "basic",
    details,
  });

  return { success: true, itemId, kind: "instagram", instagramDetails };
}
