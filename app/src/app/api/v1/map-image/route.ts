import { type NextRequest, NextResponse } from "next/server";
import { isDevelopment } from "@/env";
import { read as prisma } from "@/lib/db";
import { itemViewableWhere } from "@/lib/items/access";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/map-image");

// Server-fixed zoom so it can't be used to cache-bust the paid Mapbox proxy.
const MAP_ZOOM = 10;

// The only map sizes the client callers actually request. Anything else is
// snapped to the primary size so the billable URL set stays bounded/cacheable:
// - 368x200: LocationMap (item detail view)
// - 300x160: LocationPreview (location comparison card)
const ALLOWED_MAP_SIZES = [
  { width: 368, height: 200 },
  { width: 300, height: 160 },
] as const;
const DEFAULT_MAP_SIZE = ALLOWED_MAP_SIZES[0];

type ItemLocationRow = {
  source: string;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Snap a requested size to the allowlist. Unknown sizes fall back to the
 * primary size rather than passing attacker-controlled dimensions to Mapbox.
 */
function resolveMapSize(
  widthParam: string | null,
  heightParam: string | null,
): { width: number; height: number } {
  const width = Number.parseInt(widthParam ?? "", 10);
  const height = Number.parseInt(heightParam ?? "", 10);
  const match = ALLOWED_MAP_SIZES.find(
    (size) => size.width === width && size.height === height,
  );
  return match ?? DEFAULT_MAP_SIZE;
}

/**
 * Pick the canonical location for the map: prefer a user-set (`manual`) source,
 * otherwise any source that has coordinates. Returns null if none have coords.
 */
function pickCanonicalLocation(
  locations: ItemLocationRow[],
): { latitude: number; longitude: number } | null {
  const withCoords = locations.filter(
    (loc): loc is { source: string; latitude: number; longitude: number } =>
      loc.latitude != null && loc.longitude != null,
  );
  const canonical =
    withCoords.find((loc) => loc.source === "manual") ?? withCoords[0];
  if (!canonical) return null;
  return { latitude: canonical.latitude, longitude: canonical.longitude };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get("itemId");

    // itemId is now the source of truth (coords are derived from it), not just
    // an access token, so it's required.
    if (!itemId) {
      return NextResponse.json(
        { message: "itemId is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserWithMfa(supabase);

    // Secondary, best-effort rate limit. This is defence-in-depth only: it's
    // in-memory/per-instance, so the real fix is that coordinates are derived
    // server-side (below), which keeps the billable URL set bounded/cacheable.
    const rateLimitKey = user?.id ?? getClientIp(request.headers);
    const rateLimitResult = checkRateLimit(rateLimitKey, "mapImage");
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult, "mapImage"),
        },
      );
    }

    // Access control matching canViewItem (owner, shared via link, or in a
    // public room and not excluded). Anonymous callers only reach the shared /
    // public-room grants. The same query loads the stored locations so
    // client-supplied coordinates are never used.
    const item = await prisma.item.findFirst({
      where: { id: itemId, ...itemViewableWhere(user?.id ?? null) },
      select: {
        id: true,
        locations: {
          where: { latitude: { not: null }, longitude: { not: null } },
          select: { source: true, latitude: true, longitude: true },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const coordinates = pickCanonicalLocation(item.locations);
    if (!coordinates) {
      return NextResponse.json(
        { message: "No location for this item" },
        { status: 404 },
      );
    }

    const { latitude, longitude } = coordinates;
    const { width: imgWidth, height: imgHeight } = resolveMapSize(
      searchParams.get("width"),
      searchParams.get("height"),
    );

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      log.error("MAPBOX_ACCESS_TOKEN not configured");
      return NextResponse.json(
        { message: "Map service not configured" },
        { status: 503 },
      );
    }

    // Mapbox Static Images API (fixed host — not SSRF). Every input is now
    // server-derived: coords from the item, zoom + size from server constants.
    const marker = `pin-s+ef4444(${longitude},${latitude})`;
    const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${longitude},${latitude},${MAP_ZOOM},0/${imgWidth}x${imgHeight}@2x?access_token=${mapboxToken}`;

    log.debug(
      {
        itemId,
        latitude,
        longitude,
        zoomLevel: MAP_ZOOM,
        width: imgWidth,
        height: imgHeight,
        mapUrl: mapUrl.replace(mapboxToken, "***"),
      },
      "Fetching map image from Mapbox",
    );

    // Raw fetch is fine here — fixed host, every input server-derived (see above).
    // Exempted from the no-raw-fetch plugin by path in biome.json.
    const response = await fetch(mapUrl);

    if (!response.ok) {
      log.error(
        { status: response.status, statusText: response.statusText },
        "Mapbox API error",
      );
      return NextResponse.json(
        { message: "Failed to fetch map image" },
        { status: 502 },
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "image/png";

    // Only cache in production, not in development
    const cacheControl = isDevelopment
      ? "no-cache, no-store, must-revalidate"
      : "public, max-age=86400, s-maxage=86400";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    log.error({ error }, "Map image fetch error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/map-image",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
