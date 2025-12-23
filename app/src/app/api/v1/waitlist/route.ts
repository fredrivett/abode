import { type NextRequest, NextResponse } from "next/server";
import { joinWaitlist } from "@/lib/waitlist";

/**
 * POST /api/v1/waitlist
 * Add email to waitlist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, referralSource } = body as {
      email?: string;
      referralSource?: string;
    };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const result = await joinWaitlist(email, referralSource);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      position: result.position,
    });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
