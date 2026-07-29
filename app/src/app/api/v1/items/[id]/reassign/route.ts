import type { classifyUrlTask } from "@app/trigger/classify-url";
import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { hasFullAdminAccess } from "@/lib/admin/auth";
import db from "@/lib/db";
import { canReassignKind, isForcibleKind } from "@/lib/item-kind-reassignment";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";
import {
  guardDailyLimit,
  isSameUtcDay,
  secondsUntilUtcMidnight,
} from "@/lib/usage-limits";

const log = createLogger("api/v1/items/[id]/reassign");

/**
 * Manually reassign a URL item's kind (e.g. a page misclassified as a generic
 * webpage that's really an article). Unlike a bare PATCH, this re-runs the
 * classify → enrich pipeline with the kind forced, so the item's type-specific
 * detail data is rebuilt and stale detail rows are pruned. Only web-family
 * reassignments are allowed (see item-kind-reassignment).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { kind } = body;

    if (!isForcibleKind(kind)) {
      return NextResponse.json(
        { message: "Invalid kind: not a reassignable type" },
        { status: 400 },
      );
    }

    const item = await db.item.findUnique({
      where: { id, userId: user.id },
      select: {
        id: true,
        userId: true,
        kind: true,
        processingStatus: true,
        sourceType: true,
        sourceUrl: true,
        lastReassignedAt: true,
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    // Reassignment re-fetches the source, so it only works for URL items.
    if (item.sourceType !== "url" || !item.sourceUrl) {
      return NextResponse.json(
        { message: "Only saved links can have their type changed" },
        { status: 400 },
      );
    }

    // Enforce the allowed transitions (also rejects a no-op same-kind change).
    if (!canReassignKind(item.kind, kind)) {
      return NextResponse.json(
        { message: `Can't change this item's type to ${kind}` },
        { status: 400 },
      );
    }

    const isAdmin = await hasFullAdminAccess(supabase);

    if (
      !isAdmin &&
      item.lastReassignedAt &&
      isSameUtcDay(item.lastReassignedAt)
    ) {
      return NextResponse.json(
        { message: "You can only change an item's type once per day" },
        {
          status: 429,
          headers: { "Retry-After": String(secondsUntilUtcMidnight()) },
        },
      );
    }

    const guard = await guardDailyLimit(user.id, "reanalysis");
    if (!guard.ok) {
      return NextResponse.json(
        { message: "Daily limit reached" },
        {
          status: 429,
          headers: { "Retry-After": String(guard.check.retryAfterSeconds) },
        },
      );
    }

    const previousStatus = item.processingStatus;
    const previousLastReassignedAt = item.lastReassignedAt;

    // Reflect the pending re-analysis immediately.
    await db.item.update({
      where: { id },
      data: { processingStatus: "processing", lastReassignedAt: new Date() },
    });

    try {
      await tasks.trigger<typeof classifyUrlTask>(
        "classify-url",
        {
          itemId: id,
          userId: item.userId,
          url: item.sourceUrl,
          forcedKind: kind,
        },
        { concurrencyKey: item.userId },
      );
    } catch (triggerError) {
      log.error(
        { triggerError, itemId: id },
        "Failed to trigger reassignment task",
      );
      // Restore the prior status so the item isn't stuck "processing".
      await db.item.update({
        where: { id },
        data: {
          processingStatus: previousStatus,
          lastReassignedAt: previousLastReassignedAt,
        },
      });
      return NextResponse.json(
        { message: "Failed to initiate reassignment" },
        { status: 500 },
      );
    }

    log.info(
      { itemId: id, userId: item.userId, fromKind: item.kind, toKind: kind },
      "Reassigning item kind",
    );

    // The item_type_reassigned analytics event is captured client-side (see
    // item-type-field.tsx), matching the item_retry flow — don't double-count.
    void logActivity(user.id, "item_update", { itemId: id });

    return NextResponse.json({
      success: true,
      message: "Reassignment initiated",
      processingStatus: "processing",
    });
  } catch (error) {
    log.error({ error }, "Item reassignment error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
