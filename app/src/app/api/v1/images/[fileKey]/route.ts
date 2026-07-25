import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { canViewItem } from "@/lib/items/access";
import { findItemOwningImageKey } from "@/lib/items/image-key-lookup";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/images");

// Cache images for 1 hour in browser, 1 day on CDN
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

// Cache 404s briefly to avoid hammering DB for missing images
const CACHE_CONTROL_NOT_FOUND = "public, max-age=60, s-maxage=300";

// Cache 403s briefly - access may change if room visibility changes
const CACHE_CONTROL_FORBIDDEN = "public, max-age=60, s-maxage=60";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createSupabaseAdmin(url, key);
}

type RouteParams = {
  params: Promise<{ fileKey: string }>;
};

/**
 * Image proxy for serving images from Supabase storage.
 *
 * Access rules:
 * 1. Authenticated users can access their own images
 * 2. Anyone can access images that are in public rooms (unless excludeFromPublicRooms is true)
 *
 * Query params for image transforms (requires Supabase Pro):
 * - w: width in pixels
 * - h: height in pixels
 * - q: quality (1-100, default 80)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // fileKey comes URL-encoded, decode it (e.g., "userId%2Ffilename.jpg" -> "userId/filename.jpg")
    const { fileKey: encodedFileKey } = await params;
    const fileKey = decodeURIComponent(encodedFileKey);

    // Parse transform query params
    const searchParams = request.nextUrl.searchParams;
    const widthParam = searchParams.get("w");
    const heightParam = searchParams.get("h");
    const qualityParam = searchParams.get("q");

    const width = widthParam
      ? parseInt(widthParam, 10) || undefined
      : undefined;
    const height = heightParam
      ? parseInt(heightParam, 10) || undefined
      : undefined;
    const quality = qualityParam ? parseInt(qualityParam, 10) || 80 : 80;

    if (!fileKey) {
      return NextResponse.json(
        { message: "File key is required" },
        { status: 400 },
      );
    }

    // Check if user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Find the item that owns this key (its own fileKey/coverFileKey or a key
    // embedded in product/tweet JSON), with the fields needed to authorize.
    const item = await findItemOwningImageKey(fileKey);

    if (!item) {
      return NextResponse.json(
        { message: "Image not found" },
        {
          status: 404,
          headers: { "Cache-Control": CACHE_CONTROL_NOT_FOUND },
        },
      );
    }

    // Allow access if the viewer owns the item, it's been directly shared,
    // or it lives in a public room (and isn't excluded from public rooms).
    if (!canViewItem(item, user?.id ?? null)) {
      return NextResponse.json(
        { message: "Access denied" },
        {
          status: 403,
          headers: { "Cache-Control": CACHE_CONTROL_FORBIDDEN },
        },
      );
    }

    // Fetch the image using admin client (bypasses RLS)
    const supabaseAdmin = getSupabaseAdmin();

    // Build transform options if width or height specified
    // Note: Supabase automatically converts to WebP when transforms are applied
    // Transforms are only supported in hosted Supabase (Pro), not in local dev
    const transform =
      process.env.NODE_ENV === "production" && (width || height)
        ? {
            width,
            height,
            quality,
            resize: "contain" as const,
          }
        : undefined;

    const { data, error } = await supabaseAdmin.storage
      .from("items")
      .download(fileKey, { transform });

    if (error || !data) {
      log.error({ error, fileKey }, "Failed to download image from storage");
      return NextResponse.json(
        { message: "Failed to load image" },
        { status: 500 },
      );
    }

    // Get content type from blob, fallback to webp if transformed or infer from extension
    const contentType =
      data.type || (transform ? "image/webp" : inferContentType(fileKey));

    // Return the image with appropriate headers
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    log.error({ error }, "Image proxy error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Infer content type from file extension
 */
function inferContentType(fileKey: string): string {
  const ext = fileKey.split(".").pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return contentTypes[ext || ""] || "application/octet-stream";
}
