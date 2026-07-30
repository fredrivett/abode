import db from "@/lib/db";
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
