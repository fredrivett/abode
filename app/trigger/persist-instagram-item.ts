import { Prisma } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger, tasks } from "@trigger.dev/sdk";
import { translateToEnglish } from "../src/lib/ai/translate-to-english";
import db from "../src/lib/db";
import { rehostInstagramMedia } from "../src/lib/instagram/rehost-media";
import { pruneStaleItemDetails } from "../src/lib/item-details";
import { downloadAndStoreImage } from "../src/lib/media/rehost-image";
import { detectPlatform, normalizeUrl } from "../src/lib/platforms";
import type { ExternalLink, InstagramDetails } from "../src/lib/types/item";
import type { analyzeMediaCoverTask } from "./analyze-media-cover";
import type { enrichItemTask } from "./enrich-item";
import {
  deleteReplacedFiles,
  reclaimReplacedStorage,
} from "./reclaim-item-storage";

const TITLE_VERB: Record<InstagramDetails["mediaType"], string> = {
  post: "Post",
  reel: "Reel",
  tv: "Video",
};

type PersistOptions = {
  itemId: string;
  userId: string;
  /** The saved source URL, for the external-links entry. */
  url: string;
  captureLevel: "basic" | "full";
  /** Details to persist; media may be un-rehosted (no fileKeys yet). */
  details: InstagramDetails;
};

/**
 * Re-host an Instagram post's media, then persist it onto the item: update the
 * item row (kind, captureLevel, cover, title/description), replace the
 * ItemInstagramDetails, reclaim/delete swapped storage, and trigger enrichment.
 *
 * Shared by the URL-paste capture (`basic`, a single OG cover) and the browser
 * extension enrich pass (`full`, every carousel image). Returns the persisted
 * details (media carrying the re-hosted fileKeys).
 */
export async function persistInstagramItem(
  supabase: SupabaseClient,
  { itemId, userId, url, captureLevel, details }: PersistOptions,
): Promise<InstagramDetails> {
  const rehosted = details.media
    ? await rehostInstagramMedia(
        details.media,
        details.coverMediaIndex ?? 0,
        (imageUrl) => downloadAndStoreImage(imageUrl, userId, supabase),
      )
    : {
        media: null,
        coverFileKey: null,
        coverSize: 0,
        storedFileKeys: [] as string[],
      };

  const persisted: InstagramDetails = { ...details, media: rehosted.media };

  // Translate the caption to English for the description (no-op if already English).
  let descriptionEn: string | null = null;
  if (details.caption) {
    try {
      descriptionEn = await translateToEnglish(details.caption, {
        userId,
        itemId,
        itemKind: "instagram",
      });
    } catch (error) {
      logger.log("Failed to translate Instagram caption, using original", {
        itemId,
        error,
      });
      descriptionEn = details.caption;
    }
  }

  const normalizedUrl = normalizeUrl(url);
  const title = `${TITLE_VERB[details.mediaType]} by @${details.authorUsername}`;

  let replacedFileKeys: string[];
  try {
    replacedFileKeys = await db.$transaction(async (tx) => {
      const oldFileKeys = await reclaimReplacedStorage(tx, {
        itemId,
        userId,
        addedBytes: rehosted.coverSize,
      });

      const item = await tx.item.findUniqueOrThrow({
        where: { id: itemId, userId },
        select: { externalLinks: true, titleEditedByUser: true },
      });
      const existingLinks = (item.externalLinks as ExternalLink[] | null) ?? [];
      const hasLink = existingLinks.some(
        (link) => normalizeUrl(link.url) === normalizedUrl,
      );

      await tx.item.update({
        where: { id: itemId, userId },
        data: {
          kind: "instagram",
          captureLevel,
          // An enrich pass runs on an existing item — respect a user-edited title.
          ...(item.titleEditedByUser ? {} : { title }),
          description: descriptionEn?.slice(0, 200) ?? null,
          // Clear file columns the new kind doesn't use so they never point at a
          // blob deleteReplacedFiles is about to remove
          fileKey: null,
          coverFileKey: rehosted.coverFileKey,
          meta:
            rehosted.coverSize > 0
              ? { coverSize: rehosted.coverSize }
              : Prisma.JsonNull,
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
        postId: persisted.postId,
        mediaType: persisted.mediaType,
        authorName: persisted.authorName,
        authorUsername: persisted.authorUsername,
        caption: persisted.caption,
        postedAt: persisted.postedAt ? new Date(persisted.postedAt) : null,
        media: (persisted.media as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        likeCount: persisted.likeCount,
        commentCount: persisted.commentCount,
        coverMediaIndex: persisted.coverMediaIndex,
      };
      await tx.itemInstagramDetails.upsert({
        where: { itemId },
        create: { itemId, ...detailsData },
        update: detailsData,
      });

      return oldFileKeys;
    });
  } catch (error) {
    // Media was uploaded before this transaction; a failed commit orphans it
    // (no row references it). Delete so retries don't accumulate orphans.
    await deleteReplacedFiles(supabase, rehosted.storedFileKeys, []);
    throw error;
  }

  // Delete the previous blobs now the new media is committed
  await deleteReplacedFiles(
    supabase,
    replacedFileKeys,
    rehosted.storedFileKeys,
  );

  logger.log("Instagram item persisted", {
    itemId,
    captureLevel,
    mediaCount: persisted.media?.length ?? 0,
  });

  // Enrichment: a re-hosted cover is analysed by analyze-media-cover (blends the
  // cover's objects/OCR with the caption); a cover-less capture enriches from
  // the caption text directly.
  if (rehosted.coverFileKey) {
    await tasks.trigger<typeof analyzeMediaCoverTask>("analyze-media-cover", {
      itemId,
      userId,
      fileKey: rehosted.coverFileKey,
      extraSourceText: details.caption ?? undefined,
    });
  } else {
    await tasks.trigger<typeof enrichItemTask>("enrich-item", {
      itemId,
      userId,
      sourceText: details.caption ?? undefined,
    });
  }

  return persisted;
}
