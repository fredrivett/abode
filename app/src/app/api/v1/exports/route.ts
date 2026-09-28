import type { exportUserDataTask } from "@app/trigger/export-user-data";
import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { MAX_EXPORTS_PER_DAY } from "@/lib/export/constants";
import {
  dataExportSnapshotSelect,
  RECENT_EXPORTS_LIMIT,
  toDataExportSnapshot,
} from "@/lib/export/snapshot";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";
import { isTriggerConfigured } from "@/lib/trigger/item-runs";

const log = createLogger("api/v1/exports");

const DAY_MS = 24 * 60 * 60 * 1000;

/** The user's most recent exports, newest first — drives the settings page */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserWithMfa(supabase);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const exports = await db.dataExport.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: RECENT_EXPORTS_LIMIT,
      select: dataExportSnapshotSelect,
    });
    return NextResponse.json({ exports: exports.map(toDataExportSnapshot) });
  } catch (error) {
    log.error({ error }, "Failed to list exports");
    captureServerException(error, undefined, { route: "GET /api/v1/exports" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Requests a new data export, built in the background. Session + 2FA only —
 * never a personal access token: an export is the whole library in one file.
 * One export at a time per user, and a few per day.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserWithMfa(supabase);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // Exports are built by the background worker; degrade cleanly without it
    if (!isTriggerConfigured()) {
      return NextResponse.json(
        { message: "Exporting isn't available on this deployment" },
        { status: 503 },
      );
    }

    const active = await db.dataExport.findFirst({
      where: { userId, status: { in: ["pending", "exporting"] } },
      select: { id: true },
    });
    if (active) {
      return NextResponse.json(
        { message: "An export is already in progress", exportId: active.id },
        { status: 409 },
      );
    }

    const recent = await db.dataExport.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
    if (recent >= MAX_EXPORTS_PER_DAY) {
      return NextResponse.json(
        {
          message: `You can export up to ${MAX_EXPORTS_PER_DAY} times a day. Try again tomorrow.`,
        },
        { status: 429 },
      );
    }

    const created = await db.dataExport.create({
      data: { userId },
      select: dataExportSnapshotSelect,
    });

    try {
      await tasks.trigger<typeof exportUserDataTask>("export-user-data", {
        exportId: created.id,
        userId,
      });
    } catch (error) {
      // Never enqueued — fail it so it can't block the next request (409)
      await db.dataExport
        .update({
          where: { id: created.id },
          data: { status: "failed", error: "Couldn't start the export" },
        })
        .catch(() => {});
      throw error;
    }

    getPostHogClient()?.capture({
      distinctId: userId,
      event: "data_export_requested",
    });

    return NextResponse.json(
      { export: toDataExportSnapshot(created) },
      { status: 202 },
    );
  } catch (error) {
    log.error({ error }, "Failed to request export");
    captureServerException(error, undefined, { route: "POST /api/v1/exports" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
