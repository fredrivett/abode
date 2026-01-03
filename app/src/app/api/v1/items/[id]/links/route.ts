import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { detectPlatform } from "@/lib/platforms";
import { createClient } from "@/lib/supabase/server";
import type { ExternalLink } from "@/lib/types/item";

const log = createLogger("api/v1/items/[id]/links");

/**
 * POST /api/v1/items/[id]/links
 * Add an external link to an item.
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
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { message: "URL is required" },
        { status: 400 },
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { message: "Invalid URL format" },
        { status: 400 },
      );
    }

    // Check if item exists and belongs to user
    const item = await db.item.findUnique({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        externalLinks: true,
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    // Parse existing links
    const existingLinks = (item.externalLinks as ExternalLink[] | null) ?? [];

    // Check for duplicate URL
    if (existingLinks.some((link) => link.url === url)) {
      return NextResponse.json(
        { message: "Link already exists" },
        { status: 409 },
      );
    }

    // Detect platform and create new link
    const platform = detectPlatform(url);
    const newLink: ExternalLink = { url, platform };

    // Update item with new link
    const updatedItem = await db.item.update({
      where: { id },
      data: {
        externalLinks: [...existingLinks, newLink],
      },
      select: {
        externalLinks: true,
      },
    });

    return NextResponse.json({
      link: newLink,
      externalLinks: updatedItem.externalLinks,
    });
  } catch (error) {
    log.error({ error }, "Add link error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/items/[id]/links
 * Remove an external link from an item.
 */
export async function DELETE(
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
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { message: "URL is required" },
        { status: 400 },
      );
    }

    // Check if item exists and belongs to user
    const item = await db.item.findUnique({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        externalLinks: true,
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    // Parse existing links
    const existingLinks = (item.externalLinks as ExternalLink[] | null) ?? [];

    // Filter out the link to remove
    const updatedLinks = existingLinks.filter((link) => link.url !== url);

    if (updatedLinks.length === existingLinks.length) {
      return NextResponse.json(
        { message: "Link not found" },
        { status: 404 },
      );
    }

    // Update item
    const updatedItem = await db.item.update({
      where: { id },
      data: {
        externalLinks: updatedLinks,
      },
      select: {
        externalLinks: true,
      },
    });

    return NextResponse.json({
      externalLinks: updatedItem.externalLinks,
    });
  } catch (error) {
    log.error({ error }, "Remove link error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
