import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { zodErrorResponse } from "@/lib/http/zod-error";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/user/onboarding");

const onboardingSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

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
      },
    });

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
