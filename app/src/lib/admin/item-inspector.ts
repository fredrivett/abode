import db from "@/lib/db";
import {
  findSimilarImages,
  SIMILAR_IMAGE_MIN_SIMILARITY_CENTERED,
  SIMILAR_IMAGES_LIMIT,
} from "@/lib/search/similar-images";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TwitterMedia } from "@/lib/types/item";

/**
 * Fetch everything an admin needs to inspect a single item's internals: the
 * item, its per-kind detail rows, per-media analysis cache, and vector presence.
 *
 * Not scoped by userId — admins inspect any user's item. Vector presence comes
 * from selecting the non-`vector` columns (`model`), which Prisma can read even
 * though it can't read the `embedding` column itself; per-media embedding
 * presence is read from `embeddingModel` (non-null ⟺ an embedding was stored).
 */
export async function getItemInspection(id: string) {
  return db.item.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      kind: true,
      processingStatus: true,
      processingError: true,
      sourceType: true,
      sourceUrl: true,
      fileKey: true,
      coverFileKey: true,
      meta: true,
      title: true,
      description: true,
      titleEditedByUser: true,
      tags: true,
      userTags: true,
      notes: true,
      externalLinks: true,
      excludeFromPublicRooms: true,
      sharedAt: true,
      lastReassignedAt: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, email: true, username: true } },
      visualVectors: { select: { model: true, createdAt: true } },
      textVectors: { select: { model: true, createdAt: true } },
      mediaAnalyses: {
        select: {
          fileKey: true,
          objects: true,
          ocrText: true,
          colors: true,
          tags: true,
          visionData: true,
          embeddingModel: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      imageDetails: {
        select: {
          objects: true,
          ocrText: true,
          colors: true,
          visionData: true,
          captureDate: true,
        },
      },
      twitterDetails: {
        select: {
          tweetId: true,
          authorUsername: true,
          authorName: true,
          text: true,
          media: true,
          card: true,
          coverMediaIndex: true,
          postedAt: true,
        },
      },
      productDetails: {
        select: {
          domain: true,
          brand: true,
          price: true,
          currency: true,
          images: true,
          coverImageIndex: true,
        },
      },
      articleDetails: {
        select: {
          author: true,
          domain: true,
          publishedAt: true,
          readingTime: true,
        },
      },
      videoDetails: true,
      bookDetails: true,
      noteDetails: { select: { content: true } },
      locations: {
        select: {
          source: true,
          latitude: true,
          longitude: true,
          city: true,
          region: true,
          country: true,
          formatted: true,
        },
      },
      roomItems: {
        select: { room: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
}

export type ItemInspection = NonNullable<
  Awaited<ReturnType<typeof getItemInspection>>
>;

/** One media image reconciled against the item's analysis + cover state. */
export type MediaReconciliation = {
  index: number;
  type: string;
  /** Original (twimg) URL — public, usable as a thumbnail. */
  url: string;
  /** Our re-hosted storage key, or null if the image wasn't re-hosted. */
  fileKey: string | null;
  rehosted: boolean;
  /** Has an item_media_analysis row (vision ran on it). */
  analysed: boolean;
  /** That analysis row has a CLIP embedding. */
  hasEmbedding: boolean;
  /** The image the tweet currently displays as its cover (coverMediaIndex). */
  isCover: boolean;
  /** Its analysis is the one mirrored to item_image_details / item_visual_vectors. */
  isMirrored: boolean;
};

/**
 * Reconcile a tweet's `media[]` against `coverMediaIndex`, the item's
 * `coverFileKey`, and the per-media analysis rows — the core of the inspector's
 * media table. Surfaces drift the pipeline can produce: an unhosted or
 * unanalysed image, a cover whose analysis isn't mirrored, or a displayed cover
 * (`isCover`) that differs from the mirrored one (`isMirrored`).
 */
export function reconcileTweetMedia(
  media: TwitterMedia[],
  coverMediaIndex: number | null,
  coverFileKey: string | null,
  analyses: Array<{ fileKey: string; embeddingModel: string | null }>,
): MediaReconciliation[] {
  const byKey = new Map(analyses.map((a) => [a.fileKey, a]));
  const coverIndex = coverMediaIndex ?? 0;

  return media.map((m, index) => {
    const analysis = m.fileKey ? byKey.get(m.fileKey) : undefined;
    return {
      index,
      type: m.type,
      url: m.url,
      fileKey: m.fileKey ?? null,
      rehosted: Boolean(m.fileKey),
      analysed: Boolean(analysis),
      hasEmbedding: Boolean(analysis?.embeddingModel),
      isCover: index === coverIndex,
      isMirrored: Boolean(m.fileKey) && m.fileKey === coverFileKey,
    };
  });
}

/** How many top matches the inspector surfaces (more than the live cap, so we
 * can also show near-misses that fall just below the threshold). */
export const SIMILAR_INSPECTOR_LIMIT = 10;

export type SimilarInspectorRow<T> = T & {
  /** Clears the similarity threshold shown to users. */
  meetsThreshold: boolean;
  /** Would actually appear in the user's Similar images (passes AND within the
   * display cap). Passing rows are contiguous at the top (ordered by score). */
  shownToUser: boolean;
};

/**
 * Flag each ranked match with whether it clears the threshold and whether it
 * would actually be shown to the user (threshold + the display cap). Pure and
 * unit-tested. `results` must be ordered most→least similar.
 */
export function annotateSimilar<T extends { similarity: number }>(
  results: T[],
  threshold: number,
  shownLimit: number,
): SimilarInspectorRow<T>[] {
  let shown = 0;
  return results.map((r) => {
    const meetsThreshold = r.similarity >= threshold;
    const shownToUser = meetsThreshold && shown < shownLimit;
    if (shownToUser) shown += 1;
    return { ...r, meetsThreshold, shownToUser };
  });
}

export type InspectorSimilarImage = SimilarInspectorRow<{
  id: string;
  kind: ItemInspection["kind"];
  title: string | null;
  similarity: number;
  /** Signed thumbnail URL (admin client — works cross-user), or null. */
  imageUrl: string | null;
}>;

/** The similarity threshold + display cap the live feature uses, for the UI. */
export const SIMILAR_INSPECTOR_META = {
  threshold: SIMILAR_IMAGE_MIN_SIMILARITY_CENTERED,
  shownLimit: SIMILAR_IMAGES_LIMIT,
};

/**
 * The owner's top visually-similar images to `itemId` for the admin inspector:
 * the top {@link SIMILAR_INSPECTOR_LIMIT} regardless of threshold (so near-misses
 * are visible), each flagged for threshold/shown-to-user, with a signed
 * thumbnail. Empty when the item has no visual embedding.
 */
export async function getSimilarImagesForInspector({
  itemId,
  userId,
}: {
  itemId: string;
  userId: string;
}): Promise<InspectorSimilarImage[]> {
  const matches = await findSimilarImages({
    itemId,
    userId,
    limit: SIMILAR_INSPECTOR_LIMIT,
    threshold: -2, // below the [-1, 1] range so nothing is filtered out
  });
  if (matches.length === 0) return [];

  const rows = await db.item.findMany({
    where: { id: { in: matches.map((m) => m.id) }, userId },
    select: {
      id: true,
      kind: true,
      title: true,
      fileKey: true,
      coverFileKey: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Preserve similarity order; resolve each item's displayable image key.
  const ordered = matches.flatMap((m) => {
    const row = byId.get(m.id);
    if (!row) return [];
    return [
      {
        id: m.id,
        kind: row.kind,
        title: row.title,
        similarity: m.similarity,
        imageKey: row.coverFileKey ?? row.fileKey ?? null,
      },
    ];
  });

  // Sign small, transformed thumbnails with the service-role client (the image
  // proxy won't authorize an admin viewing another user's images). Transforming
  // avoids downloading full-res originals into a 10-cell grid. Transforms are
  // hosted-Supabase (Pro) only, so fall back to the original in dev.
  const transform =
    process.env.NODE_ENV === "production"
      ? { width: 320, height: 320, resize: "contain" as const, quality: 70 }
      : undefined;
  const keys = ordered
    .map((o) => o.imageKey)
    .filter((k): k is string => Boolean(k));
  const client = getSupabaseAdminClient();
  const signed = await Promise.all(
    keys.map(async (key) => {
      const { data } = await client.storage
        .from("items")
        .createSignedUrl(key, 3600, transform ? { transform } : undefined);
      return [key, data?.signedUrl ?? null] as const;
    }),
  );
  const urlByKey = new Map(
    signed.filter((s): s is [string, string] => s[1] !== null),
  );

  return annotateSimilar(
    ordered,
    SIMILAR_IMAGE_MIN_SIMILARITY_CENTERED,
    SIMILAR_IMAGES_LIMIT,
  ).map(({ imageKey, ...rest }) => ({
    ...rest,
    imageUrl: imageKey ? (urlByKey.get(imageKey) ?? null) : null,
  }));
}
