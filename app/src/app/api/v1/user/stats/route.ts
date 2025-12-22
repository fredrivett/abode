import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/user/stats");

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const [itemCount, roomCount] = await Promise.all([
      db.item.count({
        where: { userId: user.id, deletedAt: null },
      }),
      db.room.count({
        where: { userId: user.id },
      }),
    ]);

    return NextResponse.json({ itemCount, roomCount });
  } catch (error) {
    log.error({ error }, "Stats fetch error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
