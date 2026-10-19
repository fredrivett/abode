import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { withViewer } from "@/lib/http/with-viewer";
import { zodErrorResponse } from "@/lib/http/zod-error";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import { shouldCompleteProfile } from "@/lib/milestones/conditions";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/user/onboarding");

const onboardingSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

async function handlePATCH(request: NextRequest) {
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
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { firstName, lastName } = parsed.data;

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        onboardingCompletedAt: new Date(),
        ...(firstName !== undefined && { firstName: firstName || null }),
        ...(lastName !== undefined && { lastName: lastName || null }),
      },
      select: {
        onboardingCompletedAt: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    // The welcome dialog uploads the avatar before the name is saved here, so
    // the avatar route couldn't complete the profile — check again now
    if (shouldCompleteProfile(updatedUser)) {
      await markMilestoneComplete(user.id, "complete_profile");
    }

    // Track onboarding completion
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "onboarding_completed",
      properties: {
        has_first_name: !!firstName,
        has_last_name: !!lastName,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    log.error({ error }, "Onboarding update error");
    captureServerException(error, undefined, {
      route: "PATCH /api/v1/user/onboarding",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const PATCH = withViewer(handlePATCH);
