import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/user/onboarding");

export async function PATCH(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { onboardingCompletedAt: new Date() },
      select: { onboardingCompletedAt: true },
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
