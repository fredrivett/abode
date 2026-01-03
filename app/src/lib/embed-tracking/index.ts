import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { normalizeReferrerUrl } from "@/lib/referrer";

const log = createLogger("embed-tracking");

/**
 * Track an embed referrer. Fire-and-forget - errors are logged but don't throw.
 */
export async function trackEmbedReferrer(
  roomId: string,
  referrer: string | null,
): Promise<void> {
  const normalized = normalizeReferrerUrl(referrer);
  if (!normalized) return;

  try {
    await db.roomEmbedReferrer.upsert({
      where: {
        roomId_referrerUrl: {
          roomId,
          referrerUrl: normalized.url,
        },
      },
      create: {
        roomId,
        referrerUrl: normalized.url,
        referrerDomain: normalized.domain,
        viewCount: 1,
      },
      update: {
        lastSeenAt: new Date(),
        viewCount: { increment: 1 },
      },
    });
  } catch (error) {
    log.error(
      { error, roomId, referrer: normalized.url },
      "Failed to track embed referrer",
    );
  }
}
