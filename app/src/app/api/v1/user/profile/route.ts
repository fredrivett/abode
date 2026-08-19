import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import { zodErrorResponse } from "@/lib/http/zod-error";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import { shouldCompleteProfile } from "@/lib/milestones/conditions";
import { captureServerException } from "@/lib/posthog-server";
import { BIO_MAX_LENGTH } from "@/lib/profile";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";
import { normalizeWebsiteUrl } from "@/lib/url-utils";

const log = createLogger("api/v1/user/profile");

const profileUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  website: z.string().max(2048).optional(),
  bio: z.string().max(BIO_MAX_LENGTH).optional(),
  showInvitedBy: z.boolean().optional(),
  showInvited: z.boolean().optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const profile = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        website: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    log.error({ error }, "Profile fetch error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/user/profile",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { firstName, lastName, website, bio, showInvitedBy, showInvited } =
      parsed.data;

    // Normalize the bio: empty (or whitespace-only) clears it
    const bioValue: string | null | undefined =
      bio === undefined ? undefined : bio.trim() || null;

    // Normalize the website: empty clears it, otherwise it must be a valid URL
    let websiteValue: string | null | undefined;
    if (website !== undefined) {
      if (website.trim() === "") {
        websiteValue = null;
      } else {
        const normalized = normalizeWebsiteUrl(website);
        if (!normalized) {
          return NextResponse.json(
            { message: "Invalid website URL" },
            { status: 400 },
          );
        }
        websiteValue = normalized;
      }
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        ...(firstName !== undefined && { firstName: firstName || null }),
        ...(lastName !== undefined && { lastName: lastName || null }),
        ...(websiteValue !== undefined && { website: websiteValue }),
        ...(bioValue !== undefined && { bio: bioValue }),
        ...(showInvitedBy !== undefined && { showInvitedBy }),
        ...(showInvited !== undefined && { showInvited }),
      },
      select: {
        firstName: true,
        lastName: true,
        avatarUrl: true,
        website: true,
        bio: true,
      },
    });

    // Log activity (fire-and-forget) with the fields that were actually sent
    const changedFields = [
      ...(firstName !== undefined ? ["firstName"] : []),
      ...(lastName !== undefined ? ["lastName"] : []),
      ...(website !== undefined ? ["website"] : []),
      ...(bio !== undefined ? ["bio"] : []),
      ...(showInvitedBy !== undefined ? ["showInvitedBy"] : []),
      ...(showInvited !== undefined ? ["showInvited"] : []),
    ];
    void logActivity(user.id, "user_update", { fields: changedFields });

    // Check if profile is now complete: (firstName OR lastName) AND avatarUrl
    if (shouldCompleteProfile(updatedUser)) {
      void markMilestoneComplete(user.id, "complete_profile");
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    log.error({ error }, "Profile update error");
    captureServerException(error, undefined, {
      route: "PATCH /api/v1/user/profile",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
