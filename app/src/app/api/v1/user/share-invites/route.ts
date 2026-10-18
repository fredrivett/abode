import { NextResponse } from "next/server";
import db from "@/lib/db";
import { withViewer } from "@/lib/http/with-viewer";
import { getAvailableInvites } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/user/share-invites");

/**
 * GET /api/v1/user/share-invites
 * Whether readers of the user's shared links can join with their invites, and
 * how many invites they have left. Toggled via PATCH /api/v1/user/profile.
 */
async function handleGET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);
    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const [dbUser, availableInvites] = await Promise.all([
      db.user.findUnique({
        where: { id: user.id },
        select: { allowShareInvites: true },
      }),
      getAvailableInvites(user.id),
    ]);
    if (!dbUser) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      allowShareInvites: dbUser.allowShareInvites,
      availableInvites,
    });
  } catch (error) {
    log.error({ error }, "Failed to load share invite settings");
    captureServerException(error, undefined, {
      route: "GET /api/v1/user/share-invites",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = withViewer(handleGET);
