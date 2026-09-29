import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import {
  DOWNLOAD_URL_TTL_SECONDS,
  EXPORTS_BUCKET,
  exportDownloadFilename,
} from "@/lib/export/constants";
import { createLogger } from "@/lib/logger.server";
import { isCanonicalUuid } from "@/lib/pagination";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/exports/[id]/download");

/**
 * Downloads one part of a finished export (`?part=N`, default 1): checks the
 * signed-in owner, then redirects to a short-lived signed URL for that part in
 * the private exports bucket. The
 * URL is minted per click, so links in emails/pages never go stale or leak a
 * long-lived capability.
 */
/** `?part=N` (1-based); absent means part 1, anything else invalid is null */
function parsePartNumber(value: string | null): number | null {
  if (value === null) return 1;
  return /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export async function GET(
  request: NextRequest,
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
    // Not a UUID can't be an export; don't let it reach the uuid column
    if (!isCanonicalUuid(id)) {
      return NextResponse.json(
        { message: "Export not found" },
        { status: 404 },
      );
    }
    const part = parsePartNumber(request.nextUrl.searchParams.get("part"));
    if (part === null) {
      return NextResponse.json(
        { message: "part must be a positive whole number" },
        { status: 400 },
      );
    }

    const dataExport = await db.dataExport.findFirst({
      where: { id, userId: user.id },
      select: {
        status: true,
        completedAt: true,
        expiresAt: true,
        parts: { select: { position: true, fileKey: true } },
      },
    });
    if (!dataExport) {
      return NextResponse.json(
        { message: "Export not found" },
        { status: 404 },
      );
    }

    const { status, completedAt, expiresAt, parts } = dataExport;
    if (
      status !== "completed" ||
      parts.length === 0 ||
      !completedAt ||
      (expiresAt && expiresAt <= new Date())
    ) {
      return NextResponse.json(
        { message: "This export isn't available to download" },
        { status: 410 },
      );
    }

    const requested = parts.find(({ position }) => position === part);
    if (!requested) {
      return NextResponse.json(
        { message: "Export part not found" },
        { status: 404 },
      );
    }

    const { data, error } = await getSupabaseAdminClient()
      .storage.from(EXPORTS_BUCKET)
      .createSignedUrl(requested.fileKey, DOWNLOAD_URL_TTL_SECONDS, {
        download: exportDownloadFilename({
          completedAt,
          position: part,
          partCount: parts.length,
        }),
      });
    if (error || !data) throw error ?? new Error("No signed URL returned");

    getPostHogClient()?.capture({
      distinctId: user.id,
      event: "data_export_downloaded",
      properties: { part, part_count: dataExport.parts.length },
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
