import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/map-image");

export async function GET(request: NextRequest) {
  try {
    // Require authentication to prevent abuse
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const zoom = searchParams.get("zoom") ?? "10";
    const width = searchParams.get("width") ?? "368";
    const height = searchParams.get("height") ?? "200";

    if (!lat || !lng) {
      return NextResponse.json(
        { message: "lat and lng are required" },
        { status: 400 },
      );
    }

    const latitude = Number.parseFloat(lat);
    const longitude = Number.parseFloat(lng);
    const zoomLevel = Number.parseInt(zoom, 10);
    const imgWidth = Math.min(Number.parseInt(width, 10), 1280);
    const imgHeight = Math.min(Number.parseInt(height, 10), 1280);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { message: "Invalid coordinates" },
        { status: 400 },
      );
    }

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      log.error("MAPBOX_ACCESS_TOKEN not configured");
      return NextResponse.json(
        { message: "Map service not configured" },
        { status: 503 },
      );
    }

    // Mapbox Static Images API
    const marker = `pin-s+ef4444(${longitude},${latitude})`;
    const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${longitude},${latitude},${zoomLevel},0/${imgWidth}x${imgHeight}@2x?access_token=${mapboxToken}`;

    log.debug(
      {
        latitude,
        longitude,
        zoomLevel,
        width: imgWidth,
        height: imgHeight,
        mapUrl: mapUrl.replace(mapboxToken, "***"),
      },
      "Fetching map image from Mapbox",
    );

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
    const isDev = process.env.NODE_ENV === "development";
    const cacheControl = isDev
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
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
