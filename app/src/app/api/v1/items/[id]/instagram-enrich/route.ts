import type { enrichInstagramItemTask } from "@app/trigger/enrich-instagram-item";
import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticate-request";
import db from "@/lib/db";
import { preflight, withCors } from "@/lib/http/cors";
import { dailyLimitResponse } from "@/lib/http/daily-limit";
import { enqueueUserProcessing } from "@/lib/items/enqueue-user-processing";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import type { InstagramDetails } from "@/lib/types/item";
import { guardDailyLimit } from "@/lib/usage-limits";
import { instagramEnrichSchema } from "./schema";

const log = createLogger("api/v1/items/[id]/instagram-enrich");

// Cross-origin preflight for the browser extension (bearer-authed — see cors).
export function OPTIONS(request: NextRequest) {
  return preflight(request);
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  return withCors(request, await handlePost(request, ctx));
}

/**
 * Upgrade an existing Instagram item to `full` capture from media the browser
 * extension scraped off the logged-in post page. Validates the payload, then
 * enqueues the enrich task (which re-hosts the media and rewrites the details).
 */
async function handlePost(
  request: NextRequest,
  { params }: Ctx,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const user = auth.user;

    const parsed = instagramEnrichSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const input = parsed.data;

    const item = await db.item.findUnique({
      where: { id, userId: user.id },
      select: {
        id: true,
        kind: true,
        sourceUrl: true,
        instagramDetails: { select: { postId: true, mediaType: true } },
      },
    });
    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }
    // postId/mediaType come from the existing details row (immutable per item).
    if (item.kind !== "instagram" || !item.instagramDetails) {
      return NextResponse.json(
        { message: "Only Instagram items can be enriched" },
        { status: 400 },
      );
    }

    // Enrich re-runs image vision — cap it under the shared daily AI budget.
    const guard = await guardDailyLimit(user.id, "reanalysis");
    if (!guard.ok) {
      return dailyLimitResponse(guard.check.retryAfterSeconds);
    }

    // Atomically claim the enrichment (completed → processing) so a double-click
    // or retry can't enqueue a second paid run while one is already in flight.
    const claim = await db.item.updateMany({
      where: {
        id,
        userId: user.id,
        kind: "instagram",
        processingStatus: "completed",
      },
      // Restart the reaper clock — the item's old processingStartedAt would
      // otherwise make the stuck-items sweep mark this fresh run failed.
      data: { processingStatus: "processing", processingStartedAt: new Date() },
    });
    if (claim.count === 0) {
      return NextResponse.json(
        { message: "Enrichment already in progress" },
        { status: 409 },
      );
    }

    const details: InstagramDetails = {
      postId: item.instagramDetails.postId,
      mediaType: item.instagramDetails
        .mediaType as InstagramDetails["mediaType"],
      authorName: input.authorName ?? null,
      authorUsername: input.authorUsername,
      caption: input.caption ?? null,
      postedAt: input.postedAt ?? null,
      media: input.media,
      likeCount: input.likeCount ?? null,
      commentCount: input.commentCount ?? null,
      coverMediaIndex: input.coverMediaIndex ?? 0,
    };

    try {
      await enqueueUserProcessing<typeof enrichInstagramItemTask>(
        "enrich-instagram-item",
        { itemId: id, userId: user.id, url: item.sourceUrl ?? "", details },
        user.id,
      );
    } catch (triggerError) {
      // Release the claim so the item isn't stranded in "processing".
      await db.item
        .updateMany({
          where: { id, userId: user.id, processingStatus: "processing" },
          data: { processingStatus: "completed" },
        })
        .catch(() => {});
      log.error({ triggerError, itemId: id }, "Failed to enqueue enrich task");
      captureServerException(triggerError, undefined, {
        route: "POST /api/v1/items/[id]/instagram-enrich",
      });
      return NextResponse.json(
        { message: "Failed to initiate enrichment" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Enrichment initiated",
    });
  } catch (error) {
    log.error({ error }, "Instagram enrich error");
    captureServerException(error, undefined, {
      route: "POST /api/v1/items/[id]/instagram-enrich",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
