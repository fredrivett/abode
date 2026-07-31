import { createHash } from "node:crypto";
import { logger, task } from "@trigger.dev/sdk";
import db from "../src/lib/db";

type CheckGravatarPayload = {
  userId: string;
  email: string;
};

function md5(str: string): string {
  return createHash("md5").update(str).digest("hex");
}

/**
 * Checks whether a Gravatar exists for the user's email and, if found, saves
 * it as their avatar. Skips if the user already has an avatar set.
 */
export const checkGravatarTask = task({
  id: "check-gravatar",
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: CheckGravatarPayload) => {
    const { userId, email } = payload;

    logger.log("Checking Gravatar", {
      userId,
      email: `${email.slice(0, 3)}***`,
    });

    // Check if user already has an avatar (race condition protection)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (user?.avatarUrl) {
      logger.log("User already has avatar, skipping Gravatar check", {
        userId,
      });
      return { success: true, skipped: true, reason: "avatar_exists" };
    }

    // Generate Gravatar hash
    const hash = md5(email.toLowerCase().trim());
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=404`;

    logger.log("Checking Gravatar URL", { userId, hash });

    // Check if Gravatar exists (d=404 returns 404 if no image).
    // Raw fetch is fine here — the host is fixed and the path is a hash we built,
    // so nothing user-supplied reaches the URL. Exempted from the no-raw-fetch
    // plugin by path in biome.json.
    const response = await fetch(gravatarUrl, { method: "HEAD" });

    if (response.status === 404) {
      logger.log("No Gravatar found", { userId });
      return { success: true, found: false };
    }

    if (!response.ok) {
      // Let Trigger.dev retry on non-404 errors
      throw new Error(
        `Gravatar check failed: ${response.status} ${response.statusText}`,
      );
    }

    // Gravatar exists - save it
    const avatarUrlWithSize = `https://www.gravatar.com/avatar/${hash}?s=256`;

    await db.user.update({
      where: { id: userId },
      data: {
        avatarUrl: avatarUrlWithSize,
        avatarSource: "gravatar",
      },
    });

    logger.log("Gravatar saved", { userId });

    return { success: true, found: true, avatarUrl: avatarUrlWithSize };
  },
});
