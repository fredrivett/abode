import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { resolveSimilarImageCover } from "@/lib/search/similar-image-cover";
import { findSimilarImages } from "@/lib/search/similar-images";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/items/[id]/similar");

export type SimilarImageItem = {
  id: string;
  fileKey: string | null;
  title: string | null;
  /** Tiny LQIP data URL for the cover, for the blur-up load treatment. */
  blurDataUrl: string | null;
  similarity: number;
};

export type SimilarImagesResponse = {
  items: SimilarImageItem[];
};

/**
 * GET /api/v1/items/[id]/similar
 *
 * Returns the owner's images most visually similar to this item, ordered most
 * to least similar. Owner-scoped only (no shared/public access for now). Empty
 * when the item has no visual embedding or nothing clears the threshold.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(user.id, "similarImages");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit, "similarImages"),
        },
      );
    }

    // Confirm the source item exists and belongs to the caller before searching.
    const source = await db.item.findUnique({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!source) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const matches = await findSimilarImages({ itemId: id, userId: user.id });

    // Hydrate the matched IDs with the fields the UI renders, preserving the
    // similarity ordering (findMany doesn't guarantee order). The thumbnail and
    // its LQIP follow the cover — see resolveSimilarImageCover.
    const rows = await db.item.findMany({
      where: { id: { in: matches.map((m) => m.id) }, userId: user.id },
      select: {
        id: true,
        fileKey: true,
        coverFileKey: true,
        title: true,
        imageDetails: { select: { blurDataUrl: true } },
        mediaAnalyses: { select: { fileKey: true, blurDataUrl: true } },
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    const items: SimilarImageItem[] = matches.flatMap((match) => {
      const row = byId.get(match.id);
      if (!row) return [];
      const { fileKey, blurDataUrl } = resolveSimilarImageCover({
        fileKey: row.fileKey,
        coverFileKey: row.coverFileKey,
        imageDetailsBlurDataUrl: row.imageDetails?.blurDataUrl,
        mediaAnalyses: row.mediaAnalyses,
      });
      return [
        {
          id: row.id,
          fileKey,
          title: row.title,
          blurDataUrl,
          similarity: match.similarity,
        },
      ];
    });

    // Track how many similar images actually reach the user, so the shown-rate
    // shift from the mean-centering rollout is measurable.
    getPostHogClient()?.capture({
      distinctId: user.id,
      event: "similar_images_served",
      properties: { itemId: id, count: items.length },
    });

    return NextResponse.json({ items } satisfies SimilarImagesResponse, {
      headers: getRateLimitHeaders(rateLimit, "similarImages"),
    });
  } catch (error) {
    log.error({ error }, "Similar images lookup failed");
    captureServerException(error, undefined, {
      route: "api/v1/items/[id]/similar",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
