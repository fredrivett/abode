import { type NextRequest, NextResponse } from "next/server";
import { getUserDailyActivity } from "@/lib/activity";
import { hasFullAdminAccess } from "@/lib/admin/auth";
import type { Principal } from "@/lib/auth/authenticate-request";
import { systemDb } from "@/lib/db";
import { authedRoute } from "@/lib/http/authed-route";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/admin/users/[id]");

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/admin/users/:id - Get user detail with activity
 */
async function handleGET(
  _request: NextRequest,
  { params }: RouteParams & { principal: Principal },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check admin access with MFA
    const hasAccess = await hasFullAdminAccess(supabase);
    if (!hasAccess) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Get user details
    const user = await systemDb.user.findUnique({
      where: { id },
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
        updatedAt: true,
        _count: {
          select: {
            items: true,
            rooms: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Get 14-day activity breakdown
    const dailyActivity = await getUserDailyActivity(id, 14);

    return NextResponse.json({
      user: {
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
        updatedAt: user.updatedAt.toISOString(),
      },
      dailyActivity,
    });
  } catch (error) {
    log.error({ error }, "Admin user detail error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/admin/users/[id]",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

// Signed in through the cookie session; the admin check stays in the handler
export const GET = authedRoute({ credentials: "session" }, handleGET);
