import { type NextRequest, NextResponse } from "next/server";
import { hasFullAdminAccess } from "@/lib/admin/auth";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/admin/users");

const PAGE_SIZE = 20;

/**
 * GET /api/v1/admin/users - List all users with stats
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check admin access with MFA
    const hasAccess = await hasFullAdminAccess(supabase);
    if (!hasAccess) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const search = searchParams.get("search")?.trim() || "";

    // Build where clause
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { username: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // Get total count
    const totalCount = await db.user.count({ where });

    // Get users with aggregated counts
    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isAdmin: true,
        storageUsedBytes: true,
        createdAt: true,
        _count: {
          select: {
            items: true,
            rooms: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    });

    // Format response
    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      storageUsedBytes: user.storageUsedBytes.toString(),
      itemCount: user._count.items,
      roomCount: user._count.rooms,
      createdAt: user.createdAt.toISOString(),
    }));

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        totalCount,
        totalPages: Math.ceil(totalCount / PAGE_SIZE),
      },
    });
  } catch (error) {
    log.error({ error }, "Admin users list error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
