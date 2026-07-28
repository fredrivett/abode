import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { reverseGeocode } from "@/lib/reverse-geocode";
import { getSmartRoomsWithLocationFilter } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/server";
import { guardDailyLimit } from "@/lib/usage-limits";
import type { syncRoomItemsTask } from "../../../../../../../trigger/sync-room-items";

const log = createLogger("api/v1/items/[id]/location");

const MANUAL_SOURCE = "manual";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatLon(latitude: unknown, longitude: unknown) {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

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

    // Setting a manual location reverse-geocodes via Mapbox (paid per call).
    const guard = await guardDailyLimit(user.id, "location");
    if (!guard.ok) {
      return NextResponse.json(
        { message: "Daily limit reached" },
        {
          status: 429,
          headers: { "Retry-After": String(guard.check.retryAfterSeconds) },
        },
      );
    }

    const body = await request.json();
    const { latitude, longitude } = body;

    if (!isValidLatLon(latitude, longitude)) {
      return NextResponse.json(
        { message: "Invalid latitude or longitude" },
        { status: 400 },
      );
    }

    // Check if item exists and belongs to user
    const existingItem = await db.item.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    // Reverse geocode to get place details
    const place = await reverseGeocode({ latitude, longitude });

    // Upsert manual location (keeps any existing exif location, but only one manual override)
    const location = await db.itemLocation.upsert({
      where: {
        itemId_source: {
          itemId: id,
          source: MANUAL_SOURCE,
        },
      },
      create: {
        itemId: id,
        userId: user.id,
        source: MANUAL_SOURCE,
        latitude,
        longitude,
        neighborhood: place?.neighborhood,
        city: place?.city,
        region: place?.region,
        country: place?.country,
        countryCode: place?.countryCode,
        formatted: place?.formatted,
        raw: place?.raw as object | undefined,
      },
      update: {
        latitude,
        longitude,
        neighborhood: place?.neighborhood,
        city: place?.city,
        region: place?.region,
        country: place?.country,
        countryCode: place?.countryCode,
        formatted: place?.formatted,
        raw: place?.raw as object | undefined,
      },
      select: {
        id: true,
        source: true,
        latitude: true,
        longitude: true,
        neighborhood: true,
        city: true,
        region: true,
        country: true,
        countryCode: true,
        formatted: true,
      },
    });

    log.info({ itemId: id, location }, "Manual location set");

    // Trigger room sync for rooms with location filters
    const roomsWithLocationFilter = await getSmartRoomsWithLocationFilter(
      user.id,
    );
    if (roomsWithLocationFilter.length > 0) {
      log.info(
        { itemId: id, roomCount: roomsWithLocationFilter.length },
        "Triggering room sync for rooms with location filter",
      );
      await Promise.all(
        roomsWithLocationFilter.map((room) =>
          tasks.trigger<typeof syncRoomItemsTask>("sync-room-items", {
            roomId: room.id,
            userId: user.id,
            itemId: id,
          }),
        ),
      );
    }

    return NextResponse.json(location);
  } catch (error) {
    log.error({ error }, "Location update error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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

    // Check if item exists and belongs to user
    const existingItem = await db.item.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    // Delete only the manual location override (preserves exif location)
    await db.itemLocation.deleteMany({
      where: {
        itemId: id,
        source: MANUAL_SOURCE,
      },
    });

    log.info({ itemId: id }, "Manual location override removed");

    // Trigger room sync for rooms with location filters
    const roomsWithLocationFilter = await getSmartRoomsWithLocationFilter(
      user.id,
    );
    if (roomsWithLocationFilter.length > 0) {
      log.info(
        { itemId: id, roomCount: roomsWithLocationFilter.length },
        "Triggering room sync for rooms with location filter",
      );
      await Promise.all(
        roomsWithLocationFilter.map((room) =>
          tasks.trigger<typeof syncRoomItemsTask>("sync-room-items", {
            roomId: room.id,
            userId: user.id,
            itemId: id,
          }),
        ),
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Location delete error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
