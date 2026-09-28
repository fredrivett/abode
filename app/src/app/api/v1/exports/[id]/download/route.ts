import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import {
  DOWNLOAD_URL_TTL_SECONDS,
  EXPORTS_BUCKET,
  exportDownloadFilename,
} from "@/lib/export/constants";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/exports/[id]/download");

/**
 * Downloads a finished export: checks the signed-in owner, then redirects to
 * a short-lived signed URL for the archive in the private exports bucket. The
 * URL is minted per click, so links in emails/pages never go stale or leak a
 * long-lived capability.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserWithMfa(supabase);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const dataExport = await db.dataExport.findFirst({
      where: { id, userId: user.id },
      select: {
        status: true,
        fileKey: true,
        completedAt: true,
        expiresAt: true,
      },
    });
    if (!dataExport) {
      return NextResponse.json(
        { message: "Export not found" },
        { status: 404 },
      );
    }

    const { status, fileKey, completedAt, expiresAt } = dataExport;
    if (
      status !== "completed" ||
      !fileKey ||
      !completedAt ||
      (expiresAt && expiresAt <= new Date())
    ) {
      return NextResponse.json(
        { message: "This export isn't available to download" },
        { status: 410 },
      );
    }

    const { data, error } = await getSupabaseAdminClient()
      .storage.from(EXPORTS_BUCKET)
      .createSignedUrl(fileKey, DOWNLOAD_URL_TTL_SECONDS, {
        download: exportDownloadFilename(completedAt),
      });
    if (error || !data) throw error ?? new Error("No signed URL returned");

    getPostHogClient()?.capture({
      distinctId: user.id,
      event: "data_export_downloaded",
    });

    return NextResponse.redirect(data.signedUrl, { status: 303 });
  } catch (error) {
    log.error({ error }, "Failed to download export");
    captureServerException(error, undefined, {
      route: "GET /api/v1/exports/[id]/download",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
