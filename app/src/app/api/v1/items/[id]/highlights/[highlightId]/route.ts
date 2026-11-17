import { type NextRequest, NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import db from "@/lib/db";
import { authedRoute } from "@/lib/http/authed-route";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";

const log = createLogger("api/v1/items/[id]/highlights/[highlightId]");

type RouteParams = { params: Promise<{ id: string; highlightId: string }> };

async function handlePATCH(
  request: NextRequest,
  { params, principal }: RouteParams & { principal: Principal },
) {
  try {
    const { id: itemId, highlightId } = await params;
    const { user } = principal;

    // Verify highlight exists and belongs to user
    const existingHighlight = await db.articleHighlight.findUnique({
      where: {
        id: highlightId,
        itemId,
        userId: user.id,
      },
    });

    if (!existingHighlight) {
      return NextResponse.json(
        { message: "Highlight not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { note } = body;

    // Validate that at least one field is being updated
    if (note === undefined) {
      return NextResponse.json(
        { message: "No fields to update" },
        { status: 400 },
      );
    }

    const updatedHighlight = await db.articleHighlight.update({
      where: { id: highlightId },
      data: {
        ...(note !== undefined && { note }),
      },
      select: {
        id: true,
        itemId: true,
        startOffset: true,
        endOffset: true,
        text: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Track highlight update
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "article_highlight_updated",
      properties: {
        item_id: itemId,
        highlight_id: highlightId,
        has_note: !!note,
      },
    });

    return NextResponse.json(updatedHighlight);
  } catch (error) {
    log.error({ error }, "Highlight update error");
    captureServerException(error, undefined, {
      route: "PATCH /api/v1/items/[id]/highlights/[highlightId]",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

async function handleDELETE(
  _request: NextRequest,
  { params, principal }: RouteParams & { principal: Principal },
) {
  try {
    const { id: itemId, highlightId } = await params;
    const { user } = principal;

    // Verify highlight exists and belongs to user
    const existingHighlight = await db.articleHighlight.findUnique({
      where: {
        id: highlightId,
        itemId,
        userId: user.id,
      },
    });

    if (!existingHighlight) {
      return NextResponse.json(
        { message: "Highlight not found" },
        { status: 404 },
      );
    }

    await db.articleHighlight.delete({
      where: { id: highlightId },
    });

    // Track highlight deletion
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "article_highlight_deleted",
      properties: {
        item_id: itemId,
        highlight_id: highlightId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Highlight deletion error");
    captureServerException(error, undefined, {
      route: "DELETE /api/v1/items/[id]/highlights/[highlightId]",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const PATCH = authedRoute({ credentials: "session" }, handlePATCH);
export const DELETE = authedRoute({ credentials: "session" }, handleDELETE);
