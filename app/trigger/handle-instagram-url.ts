import { Prisma } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger, tasks } from "@trigger.dev/sdk";
import { translateToEnglish } from "../src/lib/ai/translate-to-english";
import db from "../src/lib/db";
import { extractMetaContent } from "../src/lib/html-metadata";
import { safeFetch } from "../src/lib/http/safe-fetch";
import { pruneStaleItemDetails } from "../src/lib/item-details";
import { downloadAndStoreImage } from "../src/lib/media/rehost-image";
import { detectPlatform, normalizeUrl } from "../src/lib/platforms";
import type {
  ExternalLink,
  InstagramDetails,
  InstagramMedia,
} from "../src/lib/types/item";
import type { analyzeMediaCoverTask } from "./analyze-media-cover";
import type { enrichItemTask } from "./enrich-item";
import {
  deleteReplacedFiles,
  reclaimReplacedStorage,
} from "./reclaim-item-storage";

// Instagram serves full OpenGraph tags only to whitelisted link-preview
// user-agents; a normal browser UA gets an empty shell.
const FB_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

const TITLE_VERB: Record<InstagramDetails["mediaType"], string> = {
  post: "Post",
  reel: "Reel",
  tv: "Video",
};

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
 * Handle an Instagram post URL: fetch its OpenGraph metadata, re-host the cover
 * image, and store it as a `basic`-capture instagram item. The browser
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

  // Re-host the OG cover so it survives cdninstagram URL expiry / post deletion.
  let coverFileKey: string | null = null;
  let coverSize = 0;
  const storedFileKeys: string[] = [];
  let media: InstagramMedia[] | null = og.coverImageUrl
    ? [{ type: "photo", url: og.coverImageUrl }]
    : null;
  if (og.coverImageUrl) {
    const stored = await downloadAndStoreImage(
      og.coverImageUrl,
      userId,
      supabase,
    );
    if (stored) {
      coverFileKey = stored.fileKey;
      coverSize = stored.size;
      storedFileKeys.push(stored.fileKey);
      media = [
        { type: "photo", url: og.coverImageUrl, fileKey: stored.fileKey },
      ];
    }
  }

  const details: InstagramDetails = {
    postId,
    mediaType,
    authorName: og.authorName,
    authorUsername: og.authorUsername ?? "unknown",
    caption: og.caption,
    postedAt: og.postedAt,
    media,
    likeCount: og.likeCount,
    commentCount: og.commentCount,
    coverMediaIndex: media ? 0 : null,
  };

  // Translate the caption to English for the description (no-op if already English).
  let descriptionEn: string | null = null;
  if (og.caption) {
    try {
      descriptionEn = await translateToEnglish(og.caption);
    } catch (error) {
      logger.log("Failed to translate Instagram caption, using original", {
        itemId,
        error,
      });
      descriptionEn = og.caption;
    }
  }

  const normalizedUrl = normalizeUrl(url);
  const title = og.authorUsername
    ? `${TITLE_VERB[mediaType]} by @${og.authorUsername}`
    : "Instagram post";

  let replacedFileKeys: string[];
  try {
    replacedFileKeys = await db.$transaction(async (tx) => {
      const oldFileKeys = await reclaimReplacedStorage(tx, {
        itemId,
        userId,
        addedBytes: coverSize,
      });

      const item = await tx.item.findUniqueOrThrow({
        where: { id: itemId, userId },
        select: { externalLinks: true },
      });
      const existingLinks = (item.externalLinks as ExternalLink[] | null) ?? [];
      const hasLink = existingLinks.some(
        (link) => normalizeUrl(link.url) === normalizedUrl,
      );

      await tx.item.update({
        where: { id: itemId, userId },
        data: {
          kind: "instagram",
          captureLevel: "basic",
          title,
          description: descriptionEn?.slice(0, 200) ?? null,
          // Clear file columns the new kind doesn't use so they never point at a
          // blob deleteReplacedFiles is about to remove
          fileKey: null,
          coverFileKey,
          meta: coverSize > 0 ? { coverSize } : Prisma.JsonNull,
          externalLinks: hasLink
            ? undefined
            : [
                ...existingLinks,
                { url: normalizedUrl, platform: detectPlatform(normalizedUrl) },
              ],
        },
      });

      // Drop detail rows from a prior kind (e.g. this was an article before)
      await pruneStaleItemDetails(tx, itemId, "instagram");

      const detailsData = {
        postId: details.postId,
        mediaType: details.mediaType,
        authorName: details.authorName,
        authorUsername: details.authorUsername,
        caption: details.caption,
        postedAt: details.postedAt ? new Date(details.postedAt) : null,
        media: (details.media as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        likeCount: details.likeCount,
        commentCount: details.commentCount,
        coverMediaIndex: details.coverMediaIndex,
      };
      await tx.itemInstagramDetails.upsert({
        where: { itemId },
        create: { itemId, ...detailsData },
        update: detailsData,
      });

      return oldFileKeys;
    });
  } catch (error) {
    // The cover was uploaded before this transaction; a failed commit orphans
    // it (no row references it). Delete it so retries don't accumulate orphans.
    await deleteReplacedFiles(supabase, storedFileKeys, []);
    throw error;
  }

  // Delete the previous blobs now the new cover is committed
  await deleteReplacedFiles(supabase, replacedFileKeys, storedFileKeys);

  logger.log("Instagram item saved", { itemId, postId });

  // Enrichment: a re-hosted cover is analysed by analyze-media-cover (blends the
  // cover's objects/OCR with the caption); a cover-less capture enriches from
  // the caption text directly.
  if (coverFileKey) {
    await tasks.trigger<typeof analyzeMediaCoverTask>("analyze-media-cover", {
      itemId,
      userId,
      fileKey: coverFileKey,
      extraSourceText: og.caption ?? undefined,
    });
  } else {
    await tasks.trigger<typeof enrichItemTask>("enrich-item", {
      itemId,
      userId,
      sourceText: og.caption ?? undefined,
    });
  }

  return {
    success: true,
    itemId,
    kind: "instagram",
    instagramDetails: details,
  };
}
