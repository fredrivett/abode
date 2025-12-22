import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

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
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid request body" },
        { status: 400 },
      );
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

    return NextResponse.json(updatedUser);
  } catch (error) {
    log.error({ error }, "Onboarding update error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
